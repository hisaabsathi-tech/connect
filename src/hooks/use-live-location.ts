import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import { type Coordinates, distanceInMetres } from "@/lib/maps/geo";

// Smaller moves are GPS jitter; ignoring them also keeps static-map requests down.
const MIN_MOVE_METRES = 100;

/** Foreground GPS position, updated only once the device moves `MIN_MOVE_METRES`. */
export function useLiveLocation(enabled = true) {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const lastAccepted = useRef<Coordinates | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | null = null;
    let active = true;
    const accept = (coords: Location.LocationObjectCoords) => {
      const next = { latitude: coords.latitude, longitude: coords.longitude };
      if (
        !lastAccepted.current ||
        distanceInMetres(lastAccepted.current, next) >= MIN_MOVE_METRES
      ) {
        lastAccepted.current = next;
        if (active) setLocation(next);
      }
    };
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return;
      const first = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      accept(first.coords);
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 30_000 },
        (next) => accept(next.coords),
      );
    })();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled]);

  return location;
}
