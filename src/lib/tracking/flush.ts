import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { ApiError, apiRequest } from "@/lib/api/client";
import { TOKEN_KEY } from "@/lib/auth/token-key";
import { isOnline, onReconnect, probe } from "@/lib/network/connectivity";

import {
  pendingFor,
  type QueuedPoint,
  quarantineTracking,
  readTracking,
  writeTracking,
} from "./store";

// The server takes at most this many points per request.
const BATCH = 50;
// In the foreground, send once this many points wait, or the oldest has waited this long.
const EAGER_COUNT = 5;
const EAGER_WAIT_MS = 10_000;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 2 * 60_000;
const MIN_RETRY_MS = 1_000;

export type FlushResult = "sent" | "idle" | "waiting" | "failed" | "trip-over" | "signed-out";

let running: Promise<FlushResult> | null = null;

/**
 * Sends the queued readings in batches. `force` sends whatever waits right now (a background
 * wake-up, stopping the duty); otherwise it waits until enough have piled up. A failure backs
 * off exponentially; points leave the queue only once the server has answered for them.
 */
export function flushTracking({ force = false }: { force?: boolean } = {}) {
  running ??= send(force).finally(() => {
    running = null;
  });
  return running;
}

async function send(force: boolean): Promise<FlushResult> {
  const state = readTracking();
  // Only this login's readings go out; another account's wait for it (see TrackingScope).
  const queue = pendingFor(state.identity);
  if (!queue.length) return state.queue.length && !state.identity ? "waiting" : "idle";
  // Known offline: keep recording, and send the whole backlog the moment it's back. In the
  // background no timer re-checks the connection, so ask the server once before waiting.
  if (!isOnline()) {
    await probe();
    if (!isOnline()) return "waiting";
  }
  const now = Date.now();
  if (now < state.retryAt && (!force || state.retryAfter)) return "waiting";
  if (!force) {
    const oldest = Math.min(...queue.map((point) => point.queuedAt));
    if (queue.length < EAGER_COUNT && now - oldest < EAGER_WAIT_MS) return "waiting";
  }
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return "signed-out";

  const batch = queue.slice(0, BATCH);
  const vehicleId = batch[0]?.vehicleId;
  const sameVehicle = batch.filter((point) => point.vehicleId === vehicleId);
  if (!vehicleId) return "idle";
  let incomplete = false;
  try {
    const result = await apiRequest<{
      accepted: string[];
      rejected: Array<{ clientPointId: string; code: string; retryable: boolean }>;
    }>(`/delivery/vehicles/${encodeURIComponent(vehicleId)}/track/batch`, token, {
      body: JSON.stringify({ points: sameVehicle.map(toBody) }),
      headers: {
        "X-Tracking-Queue-Age-Ms": String(
          Math.max(0, now - Math.min(...queue.map((p) => p.queuedAt))),
        ),
        "X-Tracking-Queue-Depth": String(queue.length),
      },
      method: "POST",
    });
    const accepted = new Set(result.accepted);
    drop(sameVehicle.filter((point) => accepted.has(point.clientPointId)));
    const permanent = result.rejected.filter((item) => !item.retryable);
    quarantineTracking(
      permanent.map((item) => item.clientPointId),
      permanent.map((item) => item.code).join(",") || "rejected",
    );
    const completed = new Set([...result.accepted, ...permanent.map((item) => item.clientPointId)]);
    incomplete = sameVehicle.some((point) => !completed.has(point.clientPointId));
  } catch (error) {
    backOff(error instanceof ApiError ? error.retryAfterMs : null);
    return "failed";
  }
  if (incomplete) {
    backOff(null);
    return "failed";
  }
  writeTracking((current) => ({ ...current, failures: 0, retryAfter: false, retryAt: 0 }));
  // More waiting (a long offline stretch): keep going until it has all gone, so the server's view
  // of the truck reaches its latest position now, not at the next reading.
  if (pendingFor(readTracking().identity).length > 0) return send(true);
  return "sent";
}

/**
 * Exponential backoff with full jitter, so a fleet of phones coming back online together does
 * not hit the server in step. A server `Retry-After` is a floor that even a forced send keeps.
 */
function backOff(serverDelayMs: number | null) {
  writeTracking((current) => {
    const failures = current.failures + 1;
    const ceiling = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (failures - 1));
    const jittered = Math.round(Math.random() * ceiling);
    const delay = Math.max(jittered, serverDelayMs ?? 0, MIN_RETRY_MS);
    return {
      ...current,
      failures,
      retryAfter: serverDelayMs !== null,
      retryAt: Date.now() + delay,
    };
  });
}

function drop(points: QueuedPoint[]) {
  const sent = new Set(points.map((point) => point.clientPointId));
  writeTracking((current) => ({
    ...current,
    queue: current.queue.filter((point) => !sent.has(point.clientPointId)),
  }));
}

function toBody(point: QueuedPoint) {
  return {
    accuracy: point.accuracy,
    clientPointId: point.clientPointId,
    drsId: point.drsId,
    heading: point.heading,
    latitude: point.latitude,
    longitude: point.longitude,
    recordedAt: point.recordedAt,
    speed: point.speed,
    tripId: point.tripId,
  };
}

let watching = false;
/**
 * Sends the backlog right away when the network is back or the app returns to the foreground,
 * instead of waiting for the next reading (which, parked, can be minutes away). Oldest first, so
 * the server's view of the truck lands on its latest position.
 */
export function watchTrackingFlush() {
  if (watching) return;
  watching = true;
  const flushNow = () => {
    // Back online: our own backoff starts over, but a server Retry-After still holds.
    writeTracking((current) =>
      current.retryAfter ? current : { ...current, failures: 0, retryAt: 0 },
    );
    void flushTracking({ force: true });
  };
  onReconnect(flushNow);
  AppState.addEventListener("change", (next) => {
    if (next === "active") void flushTracking({ force: true });
  });
}
