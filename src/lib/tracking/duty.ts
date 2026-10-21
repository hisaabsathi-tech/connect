import * as Location from "expo-location";

import { colors } from "@/config/colors";

import { flushTracking } from "./flush";
import { setTrackingStatus } from "./status";
import { type Duty, readTracking, writeTracking } from "./store";
import { endDuty, LIVE_TRIP_TASK } from "./task";

/**
 * What live tracking still needs from the phone:
 * - `permission`: location not allowed while in use
 * - `background`: allowed only while the app is open, not all the time
 * - `services`: the device's location is switched off
 */
export type TrackingBlocker = "permission" | "background" | "services";

/**
 * The first thing stopping background tracking, or null when it can run. Never throws: a check
 * the phone rejects (e.g. a build without background location declared) counts as not allowed.
 */
export async function trackingBlocker(): Promise<TrackingBlocker | null> {
  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted) return "permission";
  } catch {
    return "permission";
  }
  try {
    const background = await Location.getBackgroundPermissionsAsync();
    if (!background.granted) return "background";
  } catch {
    return "background";
  }
  const on = await Location.hasServicesEnabledAsync().catch(() => false);
  return on ? null : "services";
}

export function currentDuty() {
  return readTracking().duty;
}

export async function isDutyRunning() {
  return Location.hasStartedLocationUpdatesAsync(LIVE_TRIP_TASK).catch(() => false);
}

/**
 * Starts reporting this phone's location for a trip, in the background too (Android shows a
 * "Live tracking on" notification while it runs). False when something still blocks it.
 */
export async function startDuty(duty: Duty): Promise<boolean> {
  if (await trackingBlocker()) return false;
  const previous = readTracking().duty;
  writeTracking((state) => ({
    ...state,
    // A new trip measures its first reading afresh.
    anchor: previous?.tripId === duty.tripId ? state.anchor : null,
    duty,
  }));
  if (previous?.tripId === duty.tripId && (await isDutyRunning())) {
    setTrackingStatus({ running: true });
    return true;
  }
  try {
    await Location.startLocationUpdatesAsync(LIVE_TRIP_TASK, {
      accuracy: Location.Accuracy.High,
      activityType: Location.ActivityType.AutomotiveNavigation,
      // The OS hands readings over every ~5 s / 10 m; the sampler decides which are worth sending.
      distanceInterval: 10,
      timeInterval: 5_000,
      // In the background, wake the app for a batch rather than for every reading.
      deferredUpdatesDistance: 50,
      deferredUpdatesInterval: 15_000,
      foregroundService: {
        killServiceOnDestroy: false,
        notificationBody: `${duty.label} · sharing your location until the deliveries are done`,
        notificationColor: colors.primary,
        notificationTitle: "Live tracking on",
      },
      mayShowUserSettingsDialog: false,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
  } catch {
    return false;
  }
  setTrackingStatus({ running: true });
  return true;
}

/** Stops reporting: sends what is still queued, then forgets the trip. */
export async function stopDuty() {
  await flushTracking({ force: true }).catch(() => undefined);
  await endDuty();
}
