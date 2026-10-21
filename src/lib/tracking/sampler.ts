import { distanceInMetres } from "@/lib/maps/geo";

/** One GPS reading, as the location task hands it over. */
export type Fix = {
  latitude: number;
  longitude: number;
  /** Metres; null when the device doesn't say. */
  accuracy: number | null;
  /** Metres per second; null (or negative from some devices) when unknown. */
  speed: number | null;
  /** Degrees clockwise from north; null (or negative) when unknown. */
  heading: number | null;
  /** Epoch milliseconds. */
  at: number;
};

// Readings vaguer than this would draw a wobbling path while moving.
export const MAX_ACCURACY_METRES = 50;
// The trip's first point and a parked heartbeat take a coarser reading (indoors, at the hub)
// rather than none at all; the server drops anything vaguer than this.
export const MAX_FIRST_ACCURACY_METRES = 100;
// Faster than ~200 km/h between two kept points is a GPS jump, not driving.
export const MAX_SPEED_MPS = 55;
// Never two points closer in time than this, however fast the vehicle moves.
export const MIN_GAP_MS = 5_000;
// Standing still: one point this often, so the trip shows it is alive.
export const HEARTBEAT_MS = 5 * 60_000;
// Below this speed and inside the stillness radius the vehicle counts as parked.
const STILL_SPEED_MPS = 1;
const STILL_RADIUS_METRES = 15;
// Moving: the distance gate scales with speed (about 10 s of travel) within these bounds, so a
// rider in town sends every ~25 m and a van on the highway every ~250 m.
const GATE_SECONDS = 10;
const MIN_GATE_METRES = 25;
const MAX_GATE_METRES = 250;
// A turn this sharp keeps the path's shape even before the distance gate is reached.
const TURN_DEGREES = 30;
const TURN_MIN_METRES = 15;
const TURN_MIN_SPEED_MPS = 2;

const known = (value: number | null) => (value != null && value >= 0 ? value : null);

function turned(from: number | null, to: number | null) {
  const a = known(from);
  const b = known(to);
  if (a == null || b == null) return 0;
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Whether a reading is worth sending, given the last one that was. Adaptive rather than on a
 * timer: dense on slow, twisting streets, sparse on straight fast roads, a heartbeat when parked,
 * and nothing for jitter or jumps. Fewer points also means fewer map lookups on the server.
 */
export function shouldKeep(fix: Fix, last: Fix | null): boolean {
  const accuracy = fix.accuracy ?? 0;
  if (accuracy > MAX_FIRST_ACCURACY_METRES) return false;
  if (!last) return true;
  const elapsed = fix.at - last.at;
  if (elapsed <= 0) return false;
  const moved = distanceInMetres(last, fix);
  if (moved / (elapsed / 1000) > MAX_SPEED_MPS) return false;
  if (elapsed < MIN_GAP_MS) return false;
  if (elapsed >= HEARTBEAT_MS) return true;
  if (accuracy > MAX_ACCURACY_METRES) return false;

  const speed = known(fix.speed) ?? moved / (elapsed / 1000);
  const stillRadius = Math.max(STILL_RADIUS_METRES, fix.accuracy ?? 0);
  if (speed < STILL_SPEED_MPS && moved < stillRadius) return false;

  const gate = Math.min(MAX_GATE_METRES, Math.max(MIN_GATE_METRES, speed * GATE_SECONDS));
  if (moved >= gate) return true;
  return (
    speed >= TURN_MIN_SPEED_MPS &&
    moved >= TURN_MIN_METRES &&
    turned(last.heading, fix.heading) >= TURN_DEGREES
  );
}
