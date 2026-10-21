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

/** Compass bearing (degrees from north, 0–360) from `a` to `b`. */
export function bearingBetween(a: Coordinates, b: Coordinates) {
  const dLng = (b.longitude - a.longitude) * RADIANS;
  const lat1 = a.latitude * RADIANS;
  const lat2 = b.latitude * RADIANS;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Compass bearing (0–360°) pointing from `from` towards `target`.
 * When road route coordinates (`[longitude, latitude][]`) are provided, it looks forward
 * along the route from the position closest to `from` for the first point at least `minMetres`
 * away, pointing along the road path towards the delivery address.
 * Falls back to direct compass bearing from `from` to `target`.
 */
export function bearingTowardsTarget(
  from: Coordinates,
  target: Coordinates,
  routeCoords?: [number, number][] | null,
  minMetres = 10,
): number {
  if (routeCoords && routeCoords.length > 1) {
    let closestIdx = 0;
    let minDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < routeCoords.length; i++) {
      const coord = routeCoords[i];
      if (!coord) continue;
      const pt: Coordinates = { latitude: coord[1], longitude: coord[0] };
      const dist = distanceInMetres(from, pt);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    for (let i = closestIdx; i < routeCoords.length; i++) {
      const coord = routeCoords[i];
      if (!coord) continue;
      const pt: Coordinates = { latitude: coord[1], longitude: coord[0] };
      if (distanceInMetres(from, pt) >= minMetres) {
        return bearingBetween(from, pt);
      }
    }
  }

  return bearingBetween(from, target);
}

/**
 * Fewer points for drawing a long driven line (Douglas–Peucker, `toleranceMetres` off the line at
 * most). The first and last points always stay. Short lines are returned as they are; the raw
 * history is never changed, only what the map is handed.
 */
export function simplifyForDisplay<T extends Coordinates>(
  points: readonly T[],
  toleranceMetres = 4,
  minPoints = 300,
): T[] {
  if (points.length <= minPoints) return [...points];
  const first = points[0] as T;
  // Local flat projection in metres: accurate enough over a city-sized trip.
  const cos = Math.cos(first.latitude * RADIANS);
  const metresPerDegree = (EARTH_DIAMETER_METRES / 2) * RADIANS;
  const xy = points.map((point) => ({
    x: (point.longitude - first.longitude) * metresPerDegree * cos,
    y: (point.latitude - first.latitude) * metresPerDegree,
  }));
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop() as [number, number];
    const a = xy[from] as { x: number; y: number };
    const b = xy[to] as { x: number; y: number };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    let worst = -1;
    let worstAt = -1;
    for (let i = from + 1; i < to; i += 1) {
      const p = xy[i] as { x: number; y: number };
      const off =
        length === 0
          ? Math.hypot(p.x - a.x, p.y - a.y)
          : Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / length;
      if (off > worst) {
        worst = off;
        worstAt = i;
      }
    }
    if (worstAt !== -1 && worst > toleranceMetres) {
      keep[worstAt] = 1;
      stack.push([from, worstAt], [worstAt, to]);
    }
  }
  return points.filter((_, index) => keep[index] === 1);
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
