import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";

import type { LiveTrip, LiveTripOrder } from "@/lib/api/live-trips";

import { liveTripsNow } from "./live-trips-store";

const KEY = "hisaabsathi.connector.next-stops";

// Trip id → the order the driver chose to go to next. Kept on this phone across restarts.
let picks: Record<string, string> = {};
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

void SecureStore.getItemAsync(KEY)
  .then((raw) => {
    if (!raw) return;
    // A choice made before the saved ones loaded wins.
    picks = { ...(JSON.parse(raw) as Record<string, string>), ...picks };
    notify();
  })
  .catch(() => undefined);

/**
 * Makes `orderId` the trip's next stop; null goes back to the nearest order. Only trips still
 * open are remembered, so the saved list never grows.
 */
export function chooseNextStop(tripId: string, orderId: string | null) {
  const open = new Set(liveTripsNow().trips.map((trip) => trip.id));
  const next: Record<string, string> = {};
  for (const [trip, order] of Object.entries(picks)) {
    if (trip !== tripId && open.has(trip)) next[trip] = order;
  }
  if (orderId) next[tripId] = orderId;
  picks = next;
  notify();
  void SecureStore.setItemAsync(KEY, JSON.stringify(picks)).catch(() => undefined);
}

/**
 * The order a trip is heading to: the driver's choice while it is still pending, otherwise the
 * nearest one (the server sends them nearest first).
 */
export function nextStopOf(trip: LiveTrip, chosen = picks): LiveTripOrder | null {
  const pick = chosen[trip.id];
  return trip.orders.find((order) => order.orderId === pick) ?? trip.orders[0] ?? null;
}

/** Whether the trip's next stop was picked by hand (and is still pending). */
export function isChosenStop(trip: LiveTrip, chosen = picks) {
  const pick = chosen[trip.id];
  return Boolean(pick && trip.orders.some((order) => order.orderId === pick));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The saved choices; re-renders when one changes. Pass to `nextStopOf` / `isChosenStop`. */
export function useNextStopPicks() {
  return useSyncExternalStore(subscribe, () => picks);
}
