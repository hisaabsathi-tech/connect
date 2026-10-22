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
// Train testing and every road vehicle are valid through 350 km/h. Accuracy radii are subtracted
// before this implied-speed check so two noisy but honest fixes are not mistaken for a jump.
export const MAX_SPEED_MPS = 350 / 3.6;
// Never two points closer in time than this, however fast the vehicle moves.
export const MIN_GAP_MS = 5_000;
// Standing still: one point this often, so the trip shows it is alive.
export const HEARTBEAT_MS = 60_000;
// Inside this radius (or the readings' accuracy, if wider) the vehicle counts as parked.
const STILL_RADIUS_METRES = 15;
// Moving: the distance gate scales with speed and retains fewer samples on fast straight travel.
const MIN_GATE_METRES = 25;
const MAX_GATE_METRES = 1_000;
// A turn this sharp keeps the path's shape even before the distance gate is reached.
const TURN_DEGREES = 20;
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

// GPS drift standing still stays within the readings' own accuracy radii (and never under 15 m),
// so a move shorter than that says nothing about the vehicle having gone anywhere.
function stillRadius(fix: Fix, last: Fix) {
  return Math.max(STILL_RADIUS_METRES, fix.accuracy ?? 0, last.accuracy ?? 0);
}

/**
 * The reading as it should be recorded. Parked, each heartbeat reports the spot the last kept
 * point was at, not wherever GPS drift put it this minute: drift joined up fix after fix draws a
 * star of lines round one place on the trip map.
 */
export function pinWhenParked(fix: Fix, last: Fix | null): Fix {
  if (!last || distanceInMetres(last, fix) >= stillRadius(fix, last)) return fix;
  return { ...fix, accuracy: last.accuracy, latitude: last.latitude, longitude: last.longitude };
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
  const accuracyAllowance = Math.max(0, fix.accuracy ?? 0) + Math.max(0, last.accuracy ?? 0);
  const impliedSpeed = Math.max(0, moved - accuracyAllowance) / (elapsed / 1000);
  if (impliedSpeed > MAX_SPEED_MPS) return false;
  if (elapsed < MIN_GAP_MS) return false;
  if (elapsed >= HEARTBEAT_MS) return true;
  if (accuracy > MAX_ACCURACY_METRES) return false;

  // Whatever speed the device reports: parked phones claim a few m/s now and then.
  if (moved < stillRadius(fix, last)) return false;
  const travelled = moved / (elapsed / 1000);
  const speed = known(fix.speed) ?? travelled;

  // Roughly 5–10 seconds in town and 10–15 seconds at road/train speed. A sharp turn still wins
  // immediately, preserving the path without sending every native GPS fix.
  const gateSeconds = speed < 5 ? 7 : speed < 20 ? 10 : 12;
  const gate = Math.min(MAX_GATE_METRES, Math.max(MIN_GATE_METRES, speed * gateSeconds));
  if (moved >= gate) return true;
  // A turn counts only when the ground covered agrees: drift swings the heading about too.
  return (
    speed >= TURN_MIN_SPEED_MPS &&
    travelled >= TURN_MIN_SPEED_MPS &&
    moved >= TURN_MIN_METRES &&
    turned(last.heading, fix.heading) >= TURN_DEGREES
  );
}
