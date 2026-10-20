import type { StyleSpecification } from "@maplibre/maplibre-react-native";

import { env } from "@/lib/env";
import type { Coordinates } from "@/lib/maps/geo";

export const OLA_MAPS_API_BASE = "https://api.olamaps.io";

export type LatLng = { lat: number; lng: number };

export function olaMapStyleUrl(styleId = "default-light-standard") {
  const url = new URL(`/tiles/vector/v1/styles/${styleId}/style.json`, OLA_MAPS_API_BASE);
  const key = olaMapsKey();
  if (key) url.searchParams.set("api_key", key);
  return url.toString();
}

export function olaMapsKey() {
  return env.olaMapsApiKey ?? null;
}

let styleRequest: Promise<StyleSpecification | string> | null = null;

/**
 * Ola's style, fetched once and shared by every map. Some of its line layers use a one-value
 * `line-dasharray` (`[1]`), which MapLibre Native rejects with a warning per layer; web renders
 * those as solid lines, so the property is dropped. Falls back to the style URL if the fetch fails.
 */
export function loadOlaMapStyle() {
  styleRequest ??= fetch(olaMapStyleUrl())
    .then(async (response) => {
      if (!response.ok) throw new Error(`Map style request failed (${response.status}).`);
      const style = (await response.json()) as StyleSpecification;
      for (const layer of style.layers) {
        if (layer.type !== "line") continue;
        const dashes = layer.paint?.["line-dasharray"];
        if (Array.isArray(dashes) && dashes.length < 2) delete layer.paint?.["line-dasharray"];
      }
      return style;
    })
    .catch(() => {
      styleRequest = null;
      return olaMapStyleUrl();
    });
  return styleRequest;
}

/** Static PNG of the map around `center`; null when no API key is configured. */
export function staticMapUrl(
  center: Coordinates,
  zoom: number,
  styleId = "default-light-standard",
) {
  const key = olaMapsKey();
  if (!key) return null;
  return `${OLA_MAPS_API_BASE}/tiles/v1/styles/${styleId}/static/${center.longitude},${center.latitude},${zoom}/900x620.png?api_key=${encodeURIComponent(key)}`;
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

/** Best-effort street address for a point; null when it cannot be resolved. */
export async function reverseGeocodeAddress(point: Coordinates) {
  const response = await reverseGeocode({ lat: point.latitude, lng: point.longitude }).catch(
    () => null,
  );
  // Ola answers `{ results: [{ formatted_address, … }] }`, nearest place first.
  const results =
    response && typeof response === "object" && "results" in response ? response.results : null;
  const first: unknown = Array.isArray(results) ? results[0] : null;
  const address =
    first && typeof first === "object" && "formatted_address" in first
      ? first.formatted_address
      : null;
  return typeof address === "string" && address.trim() ? address.trim() : null;
}
