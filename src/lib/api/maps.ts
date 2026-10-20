import { apiRequest } from "@/lib/api/client";

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
