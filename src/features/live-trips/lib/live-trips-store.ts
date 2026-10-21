import { useSyncExternalStore } from "react";

import { fetchLiveTrips, type LiveTrip, type LiveTripPoint } from "@/lib/api/live-trips";
import { onCacheCleared, readCache, writeCache } from "@/lib/offline/cache";
import type { TripProgressEvent } from "@/lib/realtime/vehicle-trips-socket";
import { retryOnce } from "@/lib/retry";

type LiveTripsState = {
  trips: LiveTrip[];
  /** The first snapshot has answered (or failed). */
  loaded: boolean;
  /** The latest snapshot succeeded, so `trips` is the server's word (not just empty offline). */
  synced: boolean;
};

const TRIPS_CACHE = "live-trips";

// The last snapshot saved on the phone: offline (or before the first answer) the trip blocks and
// map still show, marked unsynced so nothing acts on them as the server's word.
const saved = readCache<LiveTrip[]>(TRIPS_CACHE, "trips");
let state: LiveTripsState = {
  loaded: Boolean(saved),
  synced: false,
  trips: saved?.data ?? [],
};
onCacheCleared(() => {
  generation += 1;
  set({ loaded: false, synced: false, trips: [] });
});

/** Keeps the shown trips on the phone. */
function persist() {
  writeCache(TRIPS_CACHE, "trips", state.trips, 1);
}
const listeners = new Set<() => void>();
// Snapshots can overlap (a reconnect and a pull to refresh); only the newest one lands.
let generation = 0;

function set(next: LiveTripsState) {
  state = next;
  for (const listener of listeners) listener();
}

/** As `set`, and saved on the phone. */
function save(next: LiveTripsState) {
  set(next);
  persist();
}

/** A fresh snapshot of every open trip this member may watch. */
export async function reloadLiveTrips(token: string) {
  const mine = ++generation;
  try {
    const trips = await retryOnce(() => fetchLiveTrips(token));
    if (mine !== generation) return;
    // A progress event can land while the snapshot is on its way: the newer position wins.
    const held = new Map(state.trips.map((trip) => [trip.id, trip]));
    const merged = trips.map((trip) => {
      const before = held.get(trip.id);
      return before ? { ...trip, lastPoint: newerPoint(trip.lastPoint, before.lastPoint) } : trip;
    });
    save({ loaded: true, synced: true, trips: withPending(merged) });
  } catch {
    if (mine === generation) set({ ...state, loaded: true, synced: false });
  }
}

/** The server's latest distances for a trip; a trip not held yet waits for the next snapshot. */
export function applyTripProgress(event: TripProgressEvent) {
  if (!state.trips.some((trip) => trip.id === event.tripId)) return;
  save({
    ...state,
    trips: withPending(
      state.trips.map((trip) =>
        trip.id === event.tripId
          ? {
              ...trip,
              lastPoint: newerPoint(event.lastPoint, trip.lastPoint),
              orders: event.orders,
            }
          : trip,
      ),
    ),
  });
}

export function removeLiveTrip(tripId: string) {
  if (!state.trips.some((trip) => trip.id === tripId)) return;
  save({ ...state, trips: state.trips.filter((trip) => trip.id !== tripId) });
}

/** Delivered from this phone: its block goes at once, ahead of the server's update. */
export function settleLiveTripOrder(orderId: string) {
  save({
    ...state,
    trips: withPending(
      state.trips.map((trip) => ({
        ...trip,
        orders: trip.orders.filter((order) => order.orderId !== orderId),
      })),
    ),
  });
}

/** Signed out or switched organisation: nothing carries over. */
export function resetLiveTrips() {
  generation += 1;
  set({ loaded: false, synced: false, trips: [] });
}

/** The later of two fixes by capture time, so a stale answer never moves the vehicle back. */
export function newerPoint(a: LiveTripPoint | null, b: LiveTripPoint | null) {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a.recordedAt) >= Date.parse(b.recordedAt) ? a : b;
}

// A trip with every order settled is about to close on the server; it shows nothing meanwhile.
const withPending = (trips: LiveTrip[]) => trips.filter((trip) => trip.orders.length > 0);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLiveTrips() {
  return useSyncExternalStore(subscribe, () => state);
}

/** Read outside React (the tracking host's effects). */
export function liveTripsNow() {
  return state;
}
