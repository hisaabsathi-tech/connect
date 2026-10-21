import * as SecureStore from "expo-secure-store";

import { apiRequest } from "@/lib/api/client";
import { TOKEN_KEY } from "@/lib/auth/token-key";

import { type QueuedPoint, readTracking, writeTracking } from "./store";

// The server takes at most this many points per request.
const BATCH = 50;
// In the foreground, send once this many points wait, or the oldest has waited this long.
const EAGER_COUNT = 5;
const EAGER_WAIT_MS = 10_000;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 2 * 60_000;

// The server's answers when the trip is over: the points can never be accepted.
const TRIP_OVER = ["No open vehicle trip", "not enabled"];

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
  if (!state.queue.length) return "idle";
  const now = Date.now();
  if (!force) {
    if (now < state.retryAt) return "waiting";
    const oldest = state.queue[0]?.queuedAt ?? now;
    if (state.queue.length < EAGER_COUNT && now - oldest < EAGER_WAIT_MS) return "waiting";
  }
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return "signed-out";

  const batch = state.queue.slice(0, BATCH);
  const vehicleId = batch[0]?.vehicleId;
  const sameVehicle = batch.filter((point) => point.vehicleId === vehicleId);
  if (!vehicleId) return "idle";
  try {
    await apiRequest<{ accepted: string[]; rejected: string[] }>(
      `/delivery/vehicles/${encodeURIComponent(vehicleId)}/track/batch`,
      token,
      { body: JSON.stringify({ points: sameVehicle.map(toBody) }), method: "POST" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (TRIP_OVER.some((part) => message.includes(part))) {
      drop(sameVehicle);
      return "trip-over";
    }
    writeTracking((current) => {
      const failures = current.failures + 1;
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (failures - 1));
      return { ...current, failures, retryAt: Date.now() + delay };
    });
    return "failed";
  }
  // Accepted and rejected alike are done with: a rejected point would be rejected again.
  drop(sameVehicle);
  writeTracking((current) => ({ ...current, failures: 0, retryAt: 0 }));
  // More waiting (a long offline stretch): keep going.
  if (readTracking().queue.length >= BATCH) return send(true);
  return "sent";
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
  };
}
