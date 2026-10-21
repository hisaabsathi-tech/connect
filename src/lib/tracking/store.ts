import { File, Paths } from "expo-file-system";

import type { Fix } from "./sampler";

/** The live trip this phone is reporting for. */
export type Duty = {
  tripId: string;
  drsId: string;
  vehicleId: string;
  /** Shown in the tracking notification. */
  label: string;
};

/** A kept reading waiting to be sent; `clientPointId` lets the server drop a resend. */
export type QueuedPoint = {
  clientPointId: string;
  vehicleId: string;
  drsId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
  queuedAt: number;
};

type TrackingState = {
  duty: Duty | null;
  /** The last reading kept, which the next one is measured against. */
  anchor: Fix | null;
  queue: QueuedPoint[];
  failures: number;
  /** No send before this (epoch ms) after a failure. */
  retryAt: number;
};

// Offline for a whole shift is ~1,000 points; past this the oldest go first.
const MAX_QUEUE = 2_000;
const EMPTY: TrackingState = { anchor: null, duty: null, failures: 0, queue: [], retryAt: 0 };

// A file rather than secure storage: it is written on every kept reading and must survive the
// app being killed, including when the location task starts the app headless.
let file: File | null = null;
function stateFile() {
  file ??= new File(Paths.document, "live-trip.json");
  return file;
}

let cache: TrackingState | null = null;

export function readTracking(): TrackingState {
  if (cache) return cache;
  try {
    const target = stateFile();
    cache = target.exists
      ? { ...EMPTY, ...(JSON.parse(target.textSync()) as TrackingState) }
      : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

export function writeTracking(update: (state: TrackingState) => TrackingState): TrackingState {
  const next = update(readTracking());
  const queue = next.queue.length > MAX_QUEUE ? next.queue.slice(-MAX_QUEUE) : next.queue;
  cache = { ...next, queue };
  try {
    const target = stateFile();
    if (!target.exists) target.create({ intermediates: true });
    target.write(JSON.stringify(cache));
  } catch {
    // Kept in memory; the next write tries the file again.
  }
  return cache;
}

let sequence = 0;
/** Unique per phone: time, a counter and randomness (the server keys on vehicle + this id). */
export function newPointId() {
  sequence = (sequence + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
