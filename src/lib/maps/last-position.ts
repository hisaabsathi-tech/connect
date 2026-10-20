import * as Location from "expo-location";

import { reverseGeocodeAddress } from "@/lib/maps/ola-maps";

/**
 * Where the phone last was, if location is already allowed (it never asks); empty otherwise.
 * Spread into an update so the server can note where it was made.
 */
export async function lastPosition(): Promise<{ latitude?: number; longitude?: number }> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return {};
    const position = await Location.getLastKnownPositionAsync();
    return position
      ? { latitude: position.coords.latitude, longitude: position.coords.longitude }
      : {};
  } catch {
    return {};
  }
}

// How long a fresh fix may take before a recent last-known position is used instead.
const FIX_TIMEOUT_MS = 15000;
// A last-known position counts only when it is this recent and this accurate.
const RECENT_MS = 2 * 60 * 1000;
const RECENT_ACCURACY_METRES = 100;
// The spot's street address is a nicety; the delivery doesn't wait longer than this for it.
const ADDRESS_TIMEOUT_MS = 4000;

export type HandoverSpot = { latitude: number; longitude: number; address: string | null };

/**
 * Exactly where the phone is now, for a record that must carry the true spot (a delivery being
 * confirmed): asks for location if it isn't allowed, takes a fresh high-accuracy fix, and only if
 * that is slow accepts a last-known position from the last 2 minutes within 100 m. Adds the
 * spot's street address when it resolves quickly. Throws an error saying what to do rather than
 * returning an old or missing position.
 */
export async function handoverSpot(): Promise<HandoverSpot> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain)
    permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Allow location for Hisaab Sathi Connect to confirm deliveries; each one records where it was handed over.",
    );
  if (!(await Location.hasServicesEnabledAsync().catch(() => true)))
    throw new Error("Turn on location (GPS) to confirm this delivery.");

  const fix = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
  ]);
  const recent =
    fix ??
    (await Location.getLastKnownPositionAsync({
      maxAge: RECENT_MS,
      requiredAccuracy: RECENT_ACCURACY_METRES,
    }).catch(() => null));
  if (!recent)
    throw new Error(
      "Couldn't find your location. Step outside or near a window, then confirm again.",
    );

  const point = { latitude: recent.coords.latitude, longitude: recent.coords.longitude };
  const address = await Promise.race([
    reverseGeocodeAddress(point).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ADDRESS_TIMEOUT_MS)),
  ]);
  return { ...point, address };
}
