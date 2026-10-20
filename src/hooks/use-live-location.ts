import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

import { useDialog } from "@/components/modules/dialog";
import { type Coordinates, distanceInMetres } from "@/lib/maps/geo";

// Smaller moves are GPS jitter; ignoring them also keeps static-map requests down.
const MIN_MOVE_METRES = 100;

// Never let expo-location raise the system "turn on location" dialog by itself; the app asks
// with its own sheet first (see `switchOn`).
const FIX_OPTIONS = { accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false };

/**
 * - `checking`: not known yet
 * - `denied`: permission not granted; the system dialog can still ask
 * - `blocked`: permission permanently denied; only Settings can grant it
 * - `disabled`: permission granted, but the device's location is switched off
 * - `granted`: location can be read
 */
export type LocationStatus = "checking" | "denied" | "blocked" | "disabled" | "granted";

interface SyncOptions {
  /** Ask the user (permission dialog, Allow Location sheet) when something is missing. */
  prompt: boolean;
  /** Take a fresh fix even when the position is already being watched. */
  refetch?: boolean;
}

/**
 * Foreground GPS position, updated only once the device moves `MIN_MOVE_METRES`, plus whether
 * location can be used at all. It asks for whatever is missing on every app open, re-checks
 * whenever the app comes back to the foreground, and starts reading as soon as it is allowed.
 */
export function useLiveLocation(enabled = true) {
  const dialog = useDialog();
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<LocationStatus>("checking");
  // A position request is in progress.
  const [locating, setLocating] = useState(false);
  const lastAccepted = useRef<Coordinates | null>(null);
  const watch = useRef<Location.LocationSubscription | null>(null);
  // One check at a time: the dialogs it opens background the app, which would start another.
  const running = useRef<Promise<LocationStatus> | null>(null);
  const active = useRef(true);

  const accept = useCallback((coords: Location.LocationObjectCoords) => {
    const next = { latitude: coords.latitude, longitude: coords.longitude };
    if (!lastAccepted.current || distanceInMetres(lastAccepted.current, next) >= MIN_MOVE_METRES) {
      lastAccepted.current = next;
      if (active.current) setLocation(next);
    }
  }, []);

  /** Stops reading and forgets the position, so nothing acts on a stale one. */
  const stop = useCallback(() => {
    watch.current?.remove();
    watch.current = null;
    lastAccepted.current = null;
    if (active.current) setLocation(null);
  }, []);

  /** The permission, after asking for it when `prompt` allows. */
  const permit = useCallback(
    async (prompt: boolean): Promise<LocationStatus> => {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.granted) return "granted";
      if (prompt && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) return "granted";
      } else if (prompt) {
        // Denied for good: the system dialog no longer shows, only Settings can grant it.
        const open = await dialog.confirm({
          cancelLabel: "No, thanks",
          confirmLabel: "Open settings",
          description:
            "Location permission is off for Hisaab Sathi Connect. Allow it in Settings to check in and out.",
          title: "Allow Location",
        });
        if (open) await Linking.openSettings();
      }
      return permission.canAskAgain ? "denied" : "blocked";
    },
    [dialog],
  );

  /** Whether the device's location is on, after offering to turn it on when `prompt` allows. */
  const switchOn = useCallback(
    async (prompt: boolean) => {
      if (await Location.hasServicesEnabledAsync()) return true;
      if (!prompt) return false;
      const turnOn = await dialog.confirm({
        cancelLabel: "No, thanks",
        confirmLabel: "Turn on",
        description: "To continue, your device will need to use Device Location",
        title: "Allow Location",
      });
      if (!turnOn) return false;
      if (Platform.OS !== "android") {
        // iOS has no in-app switch; the foreground re-check picks it up on return.
        await Linking.openSettings();
        return false;
      }
      try {
        // Google's one-tap "turn on device location" confirmation; resolves once it is on.
        await Location.enableNetworkProviderAsync();
        return true;
      } catch {
        return false;
      }
    },
    [dialog],
  );

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      // A fresh fix can take seconds; show the last known position meanwhile.
      if (!lastAccepted.current) {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) accept(lastKnown.coords);
      }
      accept((await Location.getCurrentPositionAsync(FIX_OPTIONS)).coords);
      if (!watch.current) {
        const subscription = await Location.watchPositionAsync(
          { ...FIX_OPTIONS, distanceInterval: 20, timeInterval: 30_000 },
          (next) => accept(next.coords),
        );
        if (active.current) watch.current = subscription;
        else subscription.remove();
      }
    } finally {
      if (active.current) setLocating(false);
    }
  }, [accept]);

  const check = useCallback(
    async ({ prompt, refetch = false }: SyncOptions): Promise<LocationStatus> => {
      const settle = (next: LocationStatus) => {
        if (next !== "granted") stop();
        if (active.current) setStatus(next);
        return next;
      };
      try {
        const permission = await permit(prompt);
        if (permission !== "granted") return settle(permission);
        if (!(await switchOn(prompt))) return settle("disabled");
        settle("granted");
        if (refetch || !watch.current) await locate();
        return "granted";
      } catch {
        // Most often the location was switched off mid-request.
        const on = await Location.hasServicesEnabledAsync().catch(() => false);
        return settle(on ? "granted" : "disabled");
      }
    },
    [locate, permit, stop, switchOn],
  );

  const sync = useCallback(
    (options: SyncOptions) => {
      running.current ??= check(options).finally(() => {
        running.current = null;
      });
      return running.current;
    },
    [check],
  );

  useEffect(() => {
    if (!enabled) return;
    active.current = true;
    void sync({ prompt: true });
    // Set when the app goes to the background on its own, not because one of the dialogs above
    // opened (the permission and "turn on" dialogs background it on Android).
    let left = false;
    const change = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        left = !running.current;
        return;
      }
      // Reopened: ask again for whatever is still missing. Back from a dialog: just re-check.
      const reopened = left;
      left = false;
      void sync({ prompt: reopened, refetch: reopened });
    });
    // Android: the window regains focus, e.g. after the quick-settings shade where location can
    // be switched off. Re-checks quietly, so check in is blocked without nagging.
    const focus = AppState.addEventListener("focus", () => {
      if (!left) void sync({ prompt: false });
    });
    return () => {
      active.current = false;
      change.remove();
      focus.remove();
      watch.current?.remove();
      watch.current = null;
    };
  }, [enabled, sync]);

  /** Tapped to fix or refresh location: asks for what's missing, then takes a fresh fix. */
  const resolve = useCallback(() => {
    void sync({ prompt: true, refetch: true });
  }, [sync]);

  /** Re-checks (asking if needed) right before location is relied on; true when it's usable. */
  const ensure = useCallback(
    async () => (await sync({ prompt: true })) === "granted" && Boolean(lastAccepted.current),
    [sync],
  );

  return { ensure, locating, location, resolve, status };
}

export type LiveLocation = ReturnType<typeof useLiveLocation>;
