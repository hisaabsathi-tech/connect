import type { Coordinates } from "@/lib/maps/geo";

// Connector v1's Google Maps links; on a phone they open the Google Maps app.

const coord = (point: Coordinates) => `${point.latitude},${point.longitude}`;

/** The place in Google Maps: its coordinates when known, otherwise the written address. */
export function googleMapsPlaceUrl({
  address,
  point,
}: {
  address: string;
  point: Coordinates | null;
}) {
  const query = point ? coord(point) : address.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Driving directions to the place; without `origin` Google Maps starts from the device. */
export function googleMapsDirectionsUrl({
  address,
  destination,
  origin,
}: {
  address: string;
  destination: Coordinates | null;
  origin: Coordinates | null;
}) {
  const params = [
    "api=1",
    `destination=${encodeURIComponent(destination ? coord(destination) : address.trim())}`,
    "travelmode=driving",
    origin ? `origin=${encodeURIComponent(coord(origin))}` : null,
  ].filter(Boolean);
  return `https://www.google.com/maps/dir/?${params.join("&")}`;
}
