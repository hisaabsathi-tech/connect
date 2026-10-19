export type Coordinates = { latitude: number; longitude: number };

export const INDIA_CENTER: Coordinates = { latitude: 22.9734, longitude: 78.6569 };

const RADIANS = Math.PI / 180;
const EARTH_DIAMETER_METRES = 12_742_000;

/** Great-circle (haversine) distance in metres. */
export function distanceInMetres(a: Coordinates, b: Coordinates) {
  const lat = (b.latitude - a.latitude) * RADIANS;
  const lng = (b.longitude - a.longitude) * RADIANS;
  const sinLat = Math.sin(lat / 2);
  const sinLng = Math.sin(lng / 2);
  return (
    EARTH_DIAMETER_METRES *
    Math.asin(
      Math.sqrt(
        sinLat * sinLat +
          Math.cos(a.latitude * RADIANS) * Math.cos(b.latitude * RADIANS) * sinLng * sinLng,
      ),
    )
  );
}

export function centerOf(points: Coordinates[]): Coordinates {
  if (!points.length) return INDIA_CENTER;
  return points.reduce(
    (sum, point) => ({
      latitude: sum.latitude + point.latitude / points.length,
      longitude: sum.longitude + point.longitude / points.length,
    }),
    { latitude: 0, longitude: 0 },
  );
}

/** Web-mercator zoom that keeps every point in a phone-sized static map. */
export function zoomToFit(points: Coordinates[]) {
  if (points.length < 2) return 15;
  let widest = 0;
  for (const point of points)
    for (const other of points) widest = Math.max(widest, distanceInMetres(point, other));
  return Math.max(10, Math.min(16, 15 - Math.log2(Math.max(1, widest) / 500)));
}

function toWorld(point: Coordinates, scale: number) {
  const sinLat = Math.sin(point.latitude * RADIANS);
  return {
    x: ((point.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

/** Pixel offset of `point` inside a map of `size` centred on `center` at `zoom`. */
export function projectToMap(
  point: Coordinates,
  center: Coordinates,
  zoom: number,
  size: { width: number; height: number },
) {
  const scale = 256 * 2 ** zoom;
  const p = toWorld(point, scale);
  const c = toWorld(center, scale);
  return { left: size.width / 2 + p.x - c.x, top: size.height / 2 + p.y - c.y };
}
