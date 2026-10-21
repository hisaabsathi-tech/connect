import { useSyncExternalStore } from "react";

/** What the screens show about live tracking on this phone. */
export type TrackingStatus = {
  /** The background location task is reporting for a trip. */
  running: boolean;
  /** When the latest reading arrived (epoch ms), kept or not. */
  lastFixAt: number | null;
};

let status: TrackingStatus = { lastFixAt: null, running: false };
const listeners = new Set<() => void>();

export function setTrackingStatus(patch: Partial<TrackingStatus>) {
  status = { ...status, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTrackingStatus() {
  return useSyncExternalStore(subscribe, () => status);
}
