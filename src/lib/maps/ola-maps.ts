import { env } from "@/lib/env";

export const OLA_MAPS_API_BASE = "https://api.olamaps.io";

export type LatLng = { lat: number; lng: number };

export function olaMapStyleUrl(styleId = "default-light-standard") {
  return `${OLA_MAPS_API_BASE}/tiles/vector/v1/styles/${styleId}/style.json`;
}

export function olaMapsKey() {
  return env.olaMapsApiKey ?? null;
}

/** Direct reverse geocode for future map screens. Other map operations stay server-proxied. */
export async function reverseGeocode(location: LatLng) {
  const apiKey = olaMapsKey();
  if (!apiKey) throw new Error("EXPO_PUBLIC_OLA_MAPS_API_KEY is missing.");
  const url = new URL("/places/v1/reverse-geocode", OLA_MAPS_API_BASE);
  url.searchParams.set("latlng", `${location.lat},${location.lng}`);

  const response = await fetch(url, { headers: { "X-API-Key": apiKey } });
  if (!response.ok) throw new Error("Could not resolve this location.");
  return (await response.json()) as unknown;
}
