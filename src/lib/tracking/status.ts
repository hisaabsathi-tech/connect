import { useSyncExternalStore } from "react";

/** What the screens show about live tracking on this phone. */
export type TrackingStatus = {
  /** The background location task is reporting for a trip. */
  running: boolean;
  /** When the latest reading arrived (epoch ms), kept or not. */
  lastFixAt: number | null;
  /**
   * What stops this phone reporting for its own live trip: "permission" (location not allowed),
   * "background" (not allowed all the time) or "services" (GPS off); null when nothing does.
   */
  blocked: "permission" | "background" | "services" | null;
};

let status: TrackingStatus = { blocked: null, lastFixAt: null, running: false };
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
