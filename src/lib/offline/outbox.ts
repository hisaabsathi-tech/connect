import { Directory, File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { patchDrs } from "@/lib/api/drs";
import { uploadDrsScan, uploadOrderPod } from "@/lib/api/media";
import { isNetworkError } from "@/lib/api/network";
import { type ShipmentStatusInput, setShipmentStatus } from "@/lib/api/order-tracking";
import { markPickupPickedUp } from "@/lib/api/pickups";
import { TOKEN_KEY } from "@/lib/auth/token-key";
import { isOnline, onReconnect } from "@/lib/network/connectivity";

type Common = {
  /** Also the server's client action id, so a resend applies once. */
  id: string;
  /** Shown in the sync list, e.g. "AWB 1234 · Delivered". */
  label: string;
  /** When it happened on the phone (ISO). */
  occurredAt: string;
  /** "failed": the server refused it; it waits for the rider to retry or discard. */
  state: "pending" | "failed";
  /** The server's reason, when it refused. */
  error?: string;
};

export type OutboxItem = Common &
  (
    | {
        kind: "shipment-status";
        orderId: string;
        drsId: string | null;
        input: Omit<ShipmentStatusInput, "clientActionId" | "occurredAt" | "scanCopy">;
        /** Proof-of-delivery photo, copied into the app's own storage. */
        photo?: string;
      }
    | { kind: "pickup-picked-up"; pickupId: string; organizationId: string }
    | { kind: "drs-scan"; drsId: string; photo: string }
  );

/** An item as a screen hands it over; the outbox adds its id, time and state. */
export type OutboxDraft = OutboxItem extends infer Item
  ? Item extends OutboxItem
    ? Omit<Item, "id" | "occurredAt" | "state" | "error">
    : never
  : never;

type Outbox = { items: OutboxItem[]; sending: boolean };

const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 2 * 60_000;
// The server answered that it already had this update (a resend after a lost answer).
const ALREADY_SAVED = "This update was already saved.";

let file: File | null = null;
let photos: Directory | null = null;
function outboxFile() {
  file ??= new File(Paths.document, "outbox.json");
  return file;
}
function photoFolder() {
  photos ??= new Directory(Paths.document, "outbox");
  return photos;
}

function readItems(): OutboxItem[] {
  try {
    const target = outboxFile();
    return target.exists ? (JSON.parse(target.textSync()) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

let state: Outbox = { items: readItems(), sending: false };
const listeners = new Set<() => void>();

function set(next: Outbox) {
  state = next;
  for (const listener of listeners) listener();
}

function saveItems(items: OutboxItem[]) {
  set({ ...state, items });
  try {
    const target = outboxFile();
    if (!target.exists) target.create({ intermediates: true });
    target.write(JSON.stringify(items));
  } catch {
    // Kept in memory; the next change tries the file again.
  }
}

let sequence = 0;
function newId() {
  sequence = (sequence + 1) % 1_000_000;
  return `act-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Copies a photo out of the camera's cache, which the system may empty before it is sent. */
function keepPhoto(uri: string, id: string) {
  try {
    const folder = photoFolder();
    if (!folder.exists) folder.create({ intermediates: true });
    const kept = new File(folder, `${id}.jpg`);
    new File(uri).copySync(kept);
    return kept.uri;
  } catch {
    return uri;
  }
}

function dropPhoto(uri: string | undefined) {
  if (!uri?.startsWith(photoFolder().uri)) return;
  try {
    new File(uri).delete();
  } catch {
    // Already gone.
  }
}

async function send(item: OutboxItem, token: string) {
  if (item.kind === "shipment-status") {
    const scanCopy = item.photo ? (await uploadOrderPod(token, item.photo)).objectKey : undefined;
    await setShipmentStatus(token, item.orderId, {
      ...item.input,
      clientActionId: item.id,
      occurredAt: item.occurredAt,
      scanCopy,
    });
  } else if (item.kind === "pickup-picked-up") {
    await markPickupPickedUp(
      token,
      { id: item.pickupId, organizationId: item.organizationId },
      item.occurredAt,
    );
  } else {
    const { objectKey } = await uploadDrsScan(token, item.photo);
    await patchDrs(token, item.drsId, { scanCopy: objectKey });
  }
}

function photoOf(item: OutboxItem) {
  return "photo" in item ? item.photo : undefined;
}

let failures = 0;
let retry: ReturnType<typeof setTimeout> | null = null;
const refusedListeners = new Set<(item: OutboxItem) => void>();

/**
 * Sends what is waiting, oldest first, one at a time: online only, and stopping at the first
 * network failure (retried with backoff and again when back online). An update the server
 * refuses is kept as failed for the rider, and the rest carry on. Updates queued meanwhile go in
 * the same run. A call while a run is going waits for that run.
 */
export function drainOutbox(): Promise<void> {
  if (!draining) {
    draining = run().finally(() => {
      draining = null;
    });
    return draining;
  }
  // A run is ending as this call comes in (e.g. back online just now): one more run follows it,
  // so the call's reason to send is never lost.
  followUp ??= draining.then(() => {
    followUp = null;
    return drainOutbox();
  });
  return followUp;
}

let draining: Promise<void> | null = null;
let followUp: Promise<void> | null = null;

async function run(): Promise<void> {
  if (!isOnline()) return;
  if (!state.items.some((item) => item.state === "pending")) return;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  set({ ...state, sending: true });
  try {
    const attempted = new Set<string>();
    for (;;) {
      const item = state.items.find((held) => held.state === "pending" && !attempted.has(held.id));
      if (!item) return;
      attempted.add(item.id);
      try {
        await send(item, token);
      } catch (error) {
        if (isNetworkError(error)) {
          failures += 1;
          const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (failures - 1));
          if (retry) clearTimeout(retry);
          retry = setTimeout(() => void drainOutbox(), delay);
          return;
        }
        const message = error instanceof Error ? error.message : "The server refused this update.";
        if (message !== ALREADY_SAVED) {
          const failed: OutboxItem = { ...item, error: message, state: "failed" };
          saveItems(state.items.map((held) => (held.id === item.id ? failed : held)));
          for (const listener of refusedListeners) listener(failed);
          continue;
        }
      }
      failures = 0;
      dropPhoto(photoOf(item));
      saveItems(state.items.filter((held) => held.id !== item.id));
    }
  } finally {
    set({ ...state, sending: false });
  }
}

/** A fresh id for an update; send it with the update, so a later resend applies once. */
export function newActionId() {
  return newId();
}

/**
 * Saves an update to send when the server is reachable, and tries at once. Pass the `id` and
 * time of an attempt that just failed offline, so a request that did reach the server isn't
 * applied twice. Returns its id.
 */
export function enqueue(
  draft: OutboxDraft,
  attempt: { id?: string; occurredAt?: string } = {},
): string {
  const id = attempt.id ?? newId();
  const photo = "photo" in draft && draft.photo ? keepPhoto(draft.photo, id) : undefined;
  const item = {
    ...draft,
    ...(photo ? { photo } : {}),
    id,
    occurredAt: attempt.occurredAt ?? new Date().toISOString(),
    state: "pending",
  } as OutboxItem;
  saveItems([...state.items, item]);
  void drainOutbox();
  return id;
}

/** Tries a refused update again (after the rider fixed what the server objected to). */
export function retryOutboxItem(id: string) {
  saveItems(
    state.items.map((item) =>
      item.id === id ? { ...item, error: undefined, state: "pending" } : item,
    ),
  );
  void drainOutbox();
}

/** Drops an update for good. */
export function discardOutboxItem(id: string) {
  const item = state.items.find((held) => held.id === id);
  dropPhoto(item ? photoOf(item) : undefined);
  saveItems(state.items.filter((held) => held.id !== id));
}

/** Everything waiting, for sign-out: none of it may be sent under the next account. */
export function clearOutbox() {
  for (const item of state.items) dropPhoto(photoOf(item));
  saveItems([]);
}

/** Called once for each update the server refuses; returns the unsubscribe. */
export function onOutboxRefused(listener: (item: OutboxItem) => void) {
  refusedListeners.add(listener);
  return () => {
    refusedListeners.delete(listener);
  };
}

let started = false;
/** Sends on launch, on every return to the app and the moment the network is back. */
export function startOutbox() {
  if (started) return;
  started = true;
  onReconnect(() => {
    failures = 0;
    void drainOutbox();
  });
  AppState.addEventListener("change", (next) => {
    if (next === "active") void drainOutbox();
  });
  void drainOutbox();
}

/** Updates still to send (failed ones included) for one order, pickup or sheet. */
export function pendingFor(items: OutboxItem[], id: string) {
  return items.filter(
    (item) =>
      (item.kind === "shipment-status" && item.orderId === id) ||
      (item.kind === "pickup-picked-up" && item.pickupId === id) ||
      (item.kind === "drs-scan" && item.drsId === id) ||
      (item.kind === "shipment-status" && item.drsId === id),
  );
}

export function outboxNow() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOutbox() {
  return useSyncExternalStore(subscribe, () => state);
}
