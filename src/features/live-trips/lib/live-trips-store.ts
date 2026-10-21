import { useSyncExternalStore } from "react";

import { fetchLiveTrips, type LiveTrip } from "@/lib/api/live-trips";
import type { TripProgressEvent } from "@/lib/realtime/vehicle-trips-socket";
import { retryOnce } from "@/lib/retry";

type LiveTripsState = {
  trips: LiveTrip[];
  /** The first snapshot has answered (or failed). */
  loaded: boolean;
  /** The latest snapshot succeeded, so `trips` is the server's word (not just empty offline). */
  synced: boolean;
};

let state: LiveTripsState = { loaded: false, synced: false, trips: [] };
const listeners = new Set<() => void>();
// Snapshots can overlap (a reconnect and a pull to refresh); only the newest one lands.
let generation = 0;

function set(next: LiveTripsState) {
  state = next;
  for (const listener of listeners) listener();
}

/** A fresh snapshot of every open trip this member may watch. */
export async function reloadLiveTrips(token: string) {
  const mine = ++generation;
  try {
    const trips = await retryOnce(() => fetchLiveTrips(token));
    if (mine === generation) set({ loaded: true, synced: true, trips: withPending(trips) });
  } catch {
    if (mine === generation) set({ ...state, loaded: true, synced: false });
  }
}

/** The server's latest distances for a trip; a trip not held yet waits for the next snapshot. */
export function applyTripProgress(event: TripProgressEvent) {
  if (!state.trips.some((trip) => trip.id === event.tripId)) return;
  set({
    ...state,
    trips: withPending(
      state.trips.map((trip) =>
        trip.id === event.tripId
          ? { ...trip, lastPoint: event.lastPoint ?? trip.lastPoint, orders: event.orders }
          : trip,
      ),
    ),
  });
}

export function removeLiveTrip(tripId: string) {
  if (!state.trips.some((trip) => trip.id === tripId)) return;
  set({ ...state, trips: state.trips.filter((trip) => trip.id !== tripId) });
}

/** Delivered from this phone: its block goes at once, ahead of the server's update. */
export function settleLiveTripOrder(orderId: string) {
  set({
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
