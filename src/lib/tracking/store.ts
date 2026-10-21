import { File, Paths } from "expo-file-system";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import type { Fix } from "./sampler";

/** The live trip this phone is reporting for. */
export type Duty = {
  tripId: string;
  drsId: string;
  vehicleId: string;
  /** Shown in the tracking notification. */
  label: string;
};

/**
 * Whose readings a row is: `${userId}:${organizationId}`. A point is only ever sent with the
 * session that recorded it, so after a logout, another sign-in or an organisation switch it
 * waits (kept, not sent with the wrong account) until that login is back.
 */
export type TrackingScope = string;

/** A kept reading waiting to be sent; `clientPointId` lets the server drop a resend. */
export type QueuedPoint = {
  clientPointId: string;
  tripId: string;
  vehicleId: string;
  drsId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
  queuedAt: number;
  /** Null only for rows from before scoping, until the next known login claims them. */
  scope: TrackingScope | null;
};

type TrackingState = {
  duty: Duty | null;
  /** The last reading kept, which the next one is measured against. */
  anchor: Fix | null;
  queue: QueuedPoint[];
  failures: number;
  /** No send before this (epoch ms) after a failure. */
  retryAt: number;
  /** `retryAt` came from the server's Retry-After, which even a forced send respects. */
  retryAfter: boolean;
  /** The login this phone is signed in as now; null while unknown or signed out. */
  identity: TrackingScope | null;
};

const EMPTY: TrackingState = {
  anchor: null,
  duty: null,
  failures: 0,
  identity: null,
  queue: [],
  retryAfter: false,
  retryAt: 0,
};

// A file rather than secure storage: it is written on every kept reading and must survive the
// app being killed, including when the location task starts the app headless.
let file: File | null = null;
function stateFile() {
  file ??= new File(Paths.document, "live-trip.json");
  return file;
}

let cache: TrackingState | null = null;
let database: SQLiteDatabase | null = null;

type QueueRow = {
  client_point_id: string;
  trip_id: string;
  vehicle_id: string;
  drs_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
  queued_at: number;
  scope: string | null;
};

function queueDb() {
  if (database) return database;
  database = openDatabaseSync("live-trip.db");
  database.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS tracking_outbox (
      client_point_id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      drs_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      recorded_at TEXT NOT NULL,
      queued_at INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending',
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS tracking_outbox_pending_idx
      ON tracking_outbox(state, queued_at);
  `);
  // Added after the first release of the table.
  const columns = database.getAllSync<{ name: string }>("PRAGMA table_info(tracking_outbox)");
  if (!columns.some((column) => column.name === "scope")) {
    database.execSync("ALTER TABLE tracking_outbox ADD COLUMN scope TEXT");
  }
  return database;
}

function readQueue(): QueuedPoint[] {
  return queueDb()
    .getAllSync<QueueRow>(
      `SELECT client_point_id, trip_id, vehicle_id, drs_id, latitude, longitude,
              accuracy, speed, heading, recorded_at, queued_at, scope
         FROM tracking_outbox WHERE state = 'pending' ORDER BY recorded_at, queued_at`,
    )
    .map((row) => ({
      accuracy: row.accuracy,
      clientPointId: row.client_point_id,
      drsId: row.drs_id,
      heading: row.heading,
      latitude: row.latitude,
      longitude: row.longitude,
      queuedAt: row.queued_at,
      recordedAt: row.recorded_at,
      scope: row.scope,
      speed: row.speed,
      tripId: row.trip_id,
      vehicleId: row.vehicle_id,
    }));
}

function insertPoint(point: QueuedPoint) {
  queueDb().runSync(
    `INSERT OR IGNORE INTO tracking_outbox
      (client_point_id, trip_id, vehicle_id, drs_id, latitude, longitude, accuracy,
       speed, heading, recorded_at, queued_at, scope, state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    point.clientPointId,
    point.tripId,
    point.vehicleId,
    point.drsId,
    point.latitude,
    point.longitude,
    point.accuracy,
    point.speed,
    point.heading,
    point.recordedAt,
    point.queuedAt,
    point.scope,
  );
}

export function readTracking(): TrackingState {
  if (cache) return cache;
  try {
    const target = stateFile();
    const legacy = target.exists ? (JSON.parse(target.textSync()) as TrackingState) : EMPTY;
    const held = readQueue();
    // One-time migration from the old JSON queue. Stable client ids make it idempotent if the
    // process dies between inserting the rows and rewriting the metadata file.
    if (held.length === 0 && legacy.queue?.length) {
      queueDb().withTransactionSync(() => {
        for (const point of legacy.queue) {
          insertPoint({
            ...point,
            scope: point.scope ?? null,
            tripId: point.tripId ?? legacy.duty?.tripId ?? "",
          });
        }
      });
    }
    cache = { ...EMPTY, ...legacy, queue: readQueue() };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

export function writeTracking(update: (state: TrackingState) => TrackingState): TrackingState {
  const previous = readTracking();
  const next = update(previous);
  const before = new Set(previous.queue.map((point) => point.clientPointId));
  const after = new Set(next.queue.map((point) => point.clientPointId));
  queueDb().withTransactionSync(() => {
    for (const point of next.queue) if (!before.has(point.clientPointId)) insertPoint(point);
    for (const id of before) {
      if (!after.has(id))
        queueDb().runSync("DELETE FROM tracking_outbox WHERE client_point_id = ?", id);
    }
  });
  cache = { ...next, queue: [...next.queue] };
  try {
    const target = stateFile();
    if (!target.exists) target.create({ intermediates: true });
    target.write(JSON.stringify({ ...cache, queue: [] }));
  } catch {
    // Kept in memory; the next write tries the file again.
  }
  return cache;
}

/** Keeps a permanently refused point for diagnostics without retrying it forever. */
export function quarantineTracking(ids: string[], reason: string) {
  if (!ids.length) return;
  queueDb().withTransactionSync(() => {
    for (const id of ids) {
      queueDb().runSync(
        "UPDATE tracking_outbox SET state = 'quarantined', error = ? WHERE client_point_id = ?",
        reason,
        id,
      );
    }
  });
  const blocked = new Set(ids);
  if (cache)
    cache = { ...cache, queue: cache.queue.filter((point) => !blocked.has(point.clientPointId)) };
}

/**
 * Records which login the phone is on now (null: signed out, or about to change). Rows saved
 * before scoping existed are claimed by the first login known after the update.
 */
export function setTrackingIdentity(identity: TrackingScope | null) {
  if (identity) {
    try {
      queueDb().runSync(
        "UPDATE tracking_outbox SET scope = ? WHERE scope IS NULL AND state = 'pending'",
        identity,
      );
    } catch {
      // The rows stay unclaimed until the next call.
    }
    cache = null;
  }
  writeTracking((state) => ({ ...state, identity }));
}

/** Points waiting for this login, oldest reading first. */
export function pendingFor(identity: TrackingScope | null): QueuedPoint[] {
  if (!identity) return [];
  return readTracking().queue.filter((point) => point.scope === identity);
}

let sequence = 0;
/** Unique per phone: time, a counter and randomness (the server keys on vehicle + this id). */
export function newPointId() {
  sequence = (sequence + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
