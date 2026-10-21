import * as Network from "expo-network";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { env } from "@/lib/env";

/**
 * - `unknown`: not checked yet (treated as online, so nothing is held back at launch)
 * - `online`: the server answered
 * - `offline`: no network, or the server can't be reached over it
 */
export type ConnectivityStatus = "unknown" | "online" | "offline";

export type Connectivity = { status: ConnectivityStatus; since: number };

// A short empty round trip to the API server (`GET`/`HEAD /ping`).
const PING_URL = `${env.apiUrl}/ping`;
const PING_TIMEOUT_MS = 5_000;
// While offline, check this often whether the server is back.
const RECHECK_MS = 30_000;

let state: Connectivity = { since: Date.now(), status: "unknown" };
const listeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();
let recheck: ReturnType<typeof setInterval> | null = null;
let started = false;
let probing: Promise<void> | null = null;

function set(status: ConnectivityStatus) {
  if (state.status === status) return;
  const was = state.status;
  state = { since: Date.now(), status };
  if (status === "offline") {
    recheck ??= setInterval(() => void probe(), RECHECK_MS);
  } else if (recheck) {
    clearInterval(recheck);
    recheck = null;
  }
  for (const listener of listeners) listener();
  if (status === "online" && was === "offline") {
    for (const listener of reconnectListeners) listener();
  }
}

/** A request reached the server: the app is online. */
export function reportReachable() {
  set("online");
}

/** A request couldn't reach the server (no network, timeout, a captive portal). */
export function reportUnreachable() {
  set("offline");
}

/** Asks the server directly; the answer settles the status. */
export function probe(): Promise<void> {
  probing ??= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      const response = await fetch(PING_URL, { method: "HEAD", signal: controller.signal });
      set(response.ok ? "online" : "offline");
    } catch {
      set("offline");
    } finally {
      clearTimeout(timer);
      probing = null;
    }
  })();
  return probing;
}

/**
 * Starts watching: the phone's network changes, the app coming back to the foreground, and a
 * first check. Safe to call more than once.
 */
export function startConnectivity() {
  if (started) return;
  started = true;
  Network.addNetworkStateListener((network) => {
    // No connection at all is certain. `isInternetReachable` isn't: it can flip false for a
    // moment on its own (switching towers, dual SIM, a VPN settling), so that gets confirmed
    // against the server rather than taken as offline on the spot.
    if (network.isConnected === false) set("offline");
    else void probe();
  });
  AppState.addEventListener("change", (next) => {
    if (next === "active") void probe();
  });
  void probe();
}

/** Called with each new status; returns the unsubscribe. */
export function onConnectivityChange(listener: (status: ConnectivityStatus) => void) {
  const notify = () => listener(state.status);
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** False only once the app knows it is offline. */
export function isOnline() {
  return state.status !== "offline";
}

/** Called each time the app comes back online after being offline; returns the unsubscribe. */
export function onReconnect(listener: () => void) {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConnectivity() {
  return useSyncExternalStore(subscribe, () => state);
}
