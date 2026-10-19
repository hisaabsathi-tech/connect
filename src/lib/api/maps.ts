import { apiRequest } from "@/lib/api/client";

/** Server-proxied forward geocode of a postal address. */
export async function geocodeAddress(address: string, token: string) {
  if (address.trim().length < 3) return null;
  return apiRequest<{ lat: number; lng: number } | null>(
    `/maps/places/geocode?address=${encodeURIComponent(address)}`,
    token,
  );
}
