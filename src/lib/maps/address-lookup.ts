import { geocodeAddress } from "@/lib/api/maps";
import { readCache, writeCache } from "@/lib/offline/cache";

import type { Coordinates } from "./geo";

// Looked-up places, kept for the app run; found ones are also saved on the phone, as an address
// rarely moves and its pin should show offline.
const places = new Map<string, Promise<Coordinates | null>>();
const PLACES_CACHE = "places";
const PLACES_LIMIT = 500;

/** Where a written address is; looked up once, then answered from memory or the phone. */
export function lookUpAddress(token: string, address: string) {
  const key = address.toLowerCase();
  let place = places.get(key);
  if (!place) {
    const saved = readCache<Coordinates>(PLACES_CACHE, key)?.data;
    place = saved
      ? Promise.resolve(saved)
      : geocodeAddress(address, token)
          .then((result) => {
            const found = result ? { latitude: result.lat, longitude: result.lng } : null;
            if (found) writeCache(PLACES_CACHE, key, found, PLACES_LIMIT);
            return found;
          })
          .catch(() => {
            places.delete(key);
            return null;
          });
    places.set(key, place);
  }
  return place;
}

/** Address parts with the blanks dropped, comma-separated. */
export const joinAddress = (parts: (string | null | undefined)[]) =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
