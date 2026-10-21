import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";

import { flushTracking } from "./flush";
import { type Fix, shouldKeep } from "./sampler";
import { setTrackingStatus } from "./status";
import { newPointId, readTracking, writeTracking } from "./store";

export const LIVE_TRIP_TASK = "hisaabsathi.live-trip-location";

type LocationTaskData = { locations?: Location.LocationObject[] };

/**
 * Keeps the readings worth sending and queues them for the trip on duty. Runs inside the
 * location task, with the app open or not, and needs nothing from the React tree.
 */
export async function recordFixes(locations: Location.LocationObject[]) {
  const { duty } = readTracking();
  if (!duty) {
    // Left running after its trip ended (e.g. the app was killed mid-stop).
    await endDuty();
    return;
  }
  const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length) setTrackingStatus({ lastFixAt: Date.now(), running: true });
  // The trip's very first point goes out at once, so everyone watching sees the truck.
  const first = readTracking().anchor === null;
  writeTracking((state) => {
    let anchor = state.anchor;
    const queue = [...state.queue];
    for (const location of sorted) {
      const fix: Fix = {
        accuracy: location.coords.accuracy ?? null,
        at: location.timestamp,
        heading: location.coords.heading ?? null,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: location.coords.speed ?? null,
      };
      if (location.mocked || !shouldKeep(fix, anchor)) continue;
      anchor = fix;
      queue.push({
        accuracy: fix.accuracy,
        clientPointId: newPointId(),
        drsId: duty.drsId,
        heading: fix.heading != null && fix.heading >= 0 ? fix.heading : null,
        latitude: fix.latitude,
        longitude: fix.longitude,
        queuedAt: Date.now(),
        recordedAt: new Date(fix.at).toISOString(),
        speed: fix.speed != null && fix.speed >= 0 ? fix.speed : null,
        vehicleId: duty.vehicleId,
      });
    }
    return { ...state, anchor, queue };
  });
  // In the background each wake-up already batches readings, so send what is there.
  const result = await flushTracking({
    force: first || AppState.currentState !== "active",
  });
  // Signed out on this phone: nobody to report for any more.
  if (result === "trip-over" || result === "signed-out") await endDuty();
}

/** Stops reading and forgets the duty; whatever is still queued for it can't be accepted. */
export async function endDuty() {
  await Location.stopLocationUpdatesAsync(LIVE_TRIP_TASK).catch(() => undefined);
  writeTracking((state) => ({ ...state, anchor: null, duty: null }));
  setTrackingStatus({ running: false });
}

// Must run at module scope: a background start has no screens mounted to define it later.
TaskManager.defineTask<LocationTaskData>(LIVE_TRIP_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await recordFixes(data.locations);
});
