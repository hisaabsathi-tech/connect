import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

import { useAuthSession } from "@/lib/auth/session";
import { connectTripFeed } from "@/lib/realtime/vehicle-trips-socket";
import {
  currentDuty,
  isDutyRunning,
  startDuty,
  stopDuty,
  type TrackingBlocker,
  trackingBlocker,
} from "@/lib/tracking/duty";
import { setTrackingStatus } from "@/lib/tracking/status";

import { LocationGuardSheet } from "./components/location-guard-sheet";
import {
  applyTripProgress,
  reloadLiveTrips,
  removeLiveTrip,
  resetLiveTrips,
  useLiveTrips,
} from "./lib/live-trips-store";

/**
 * Keeps the live trips current and this phone's part in them:
 * - one socket to the server's trip feed while the app is open (no polling); every (re)connect
 *   reloads a snapshot, so nothing missed while away is lost
 * - while a trip this member drives is open, the background location task reports for it, and
 *   stops once the trip ends
 * - while that trip is on, a sheet nobody can dismiss asks for location whenever it is blocked
 */
export function LiveTripHost() {
  const { token } = useAuthSession();
  const { synced, trips } = useLiveTrips();
  const mine = trips.find((trip) => trip.mine && trip.drsId) ?? null;
  const [blocker, setBlocker] = useState<TrackingBlocker | null>(null);
  const [fixing, setFixing] = useState(false);

  // The feed: connected in the foreground only. In the background the location task carries on
  // by itself, and the reconnect on return reloads whatever changed meanwhile.
  useEffect(() => {
    if (!token) return;
    let disconnect: (() => void) | null = null;
    const connect = () => {
      disconnect ??= connectTripFeed(token, {
        onClosed: (event) => removeLiveTrip(event.tripId),
        onConnect: () => void reloadLiveTrips(token),
        onOpened: () => void reloadLiveTrips(token),
        onProgress: applyTripProgress,
      });
    };
    connect();
    const change = AppState.addEventListener("change", (next) => {
      if (next === "active") connect();
      else {
        disconnect?.();
        disconnect = null;
      }
    });
    return () => {
      change.remove();
      disconnect?.();
      resetLiveTrips();
    };
  }, [token]);

  // Brings the duty in line with the trips: on for my open trip, off once there is none.
  const tripId = mine?.id ?? null;
  const drsId = mine?.drsId ?? null;
  const vehicleId = mine?.vehicleId ?? null;
  const reconcile = useCallback(async () => {
    // Offline or not loaded yet: a missing trip proves nothing, so a running duty carries on.
    if (!synced) return;
    if (!(tripId && drsId && vehicleId)) {
      setBlocker(null);
      if (currentDuty() || (await isDutyRunning())) await stopDuty();
      return;
    }
    const missing = await trackingBlocker().catch(() => null);
    setBlocker(missing);
    if (missing) {
      setTrackingStatus({ running: false });
      return;
    }
    await startDuty({ drsId, label: `DRS ${drsId}`, tripId, vehicleId });
  }, [drsId, synced, tripId, vehicleId]);

  useEffect(() => {
    void reconcile();
  }, [reconcile]);

  // Location can be switched off or revoked at any time (quick settings, the Settings app);
  // every return to the app, and on Android every regained focus, checks again.
  const latest = useRef(reconcile);
  latest.current = reconcile;
  useEffect(() => {
    if (!tripId) return;
    const change = AppState.addEventListener("change", (next) => {
      if (next === "active") void latest.current();
    });
    const focus = AppState.addEventListener("focus", () => void latest.current());
    return () => {
      change.remove();
      focus.remove();
    };
  }, [tripId]);

  const fix = async () => {
    if (!blocker) return;
    setFixing(true);
    try {
      if (blocker === "permission") {
        const result = await Location.requestForegroundPermissionsAsync();
        if (!(result.granted || result.canAskAgain)) await Linking.openSettings();
      } else if (blocker === "background") {
        // Android 11+ opens the app's location page, where "Allow all the time" is chosen.
        const result = await Location.requestBackgroundPermissionsAsync();
        if (!(result.granted || result.canAskAgain)) await Linking.openSettings();
      } else if (Platform.OS === "android") {
        await Location.enableNetworkProviderAsync().catch(() => undefined);
      } else {
        await Linking.openSettings();
      }
    } finally {
      setFixing(false);
      await reconcile();
    }
  };

  return <LocationGuardSheet blocker={blocker} busy={fixing} onFix={() => void fix()} />;
}
