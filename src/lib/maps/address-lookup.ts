import { geocodeAddress } from "@/lib/api/maps";

import type { Coordinates } from "./geo";

// Looked-up places, kept for the app run (the server caches them for longer).
const places = new Map<string, Promise<Coordinates | null>>();

/** Where a written address is; looked up once per app run, then answered from memory. */
export function lookUpAddress(token: string, address: string) {
  const key = address.toLowerCase();
  let place = places.get(key);
  if (!place) {
    place = geocodeAddress(address, token)
      .then((result) => (result ? { latitude: result.lat, longitude: result.lng } : null))
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
