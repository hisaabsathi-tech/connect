import { apiRequest } from "@/lib/api/client";
import type { Coordinates } from "@/lib/maps/geo";

export type AddressSuggestion = {
  description: string;
  placeId: string;
  primary: string | null;
  secondary: string | null;
};

/** Ola Maps suggestions, proxied through the API so map credentials never reach the app. */
export async function autocompleteAddress(
  input: string,
  token: string,
): Promise<AddressSuggestion[]> {
  if (input.trim().length < 3) return [];
  const result = await apiRequest<{
    predictions: Array<{
      description: string;
      place_id: string;
      structured_formatting?: { main_text?: string; secondary_text?: string } | null;
    }>;
  }>(`/maps/places/autocomplete?input=${encodeURIComponent(input)}`, token);
  return result.predictions.map((prediction) => ({
    description: prediction.description,
    placeId: prediction.place_id,
    primary: prediction.structured_formatting?.main_text ?? null,
    secondary: prediction.structured_formatting?.secondary_text ?? null,
  }));
}

/** Server-proxied forward geocode of a postal address. */
export async function geocodeAddress(address: string, token: string) {
  if (address.trim().length < 3) return null;
  return apiRequest<{ lat: number; lng: number } | null>(
    `/maps/places/geocode?address=${encodeURIComponent(address)}`,
    token,
  );
}

export type RoadRoute = {
  /** The road path as `[longitude, latitude]` pairs, simplified by the server. */
  coordinates: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
};

/** Server-proxied driving route between two points (Ola Maps); null when none is found. */
export async function fetchRoute(
  token: string,
  from: Coordinates,
  to: Coordinates,
): Promise<RoadRoute | null> {
  const result = await apiRequest<RoadRoute | null>(
    `/maps/places/route?from=${from.latitude},${from.longitude}&to=${to.latitude},${to.longitude}`,
    token,
  );
  return result && result.coordinates?.length > 1 ? result : null;
}
