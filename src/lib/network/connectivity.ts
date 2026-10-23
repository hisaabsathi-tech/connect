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

/**
 * Why the app is offline:
 * - `no_network`: device is disconnected from Wi-Fi and mobile data
 * - `server_unreachable`: device has internet, but cannot reach the API server
 */
export type OfflineReason = "no_network" | "server_unreachable";

export type Connectivity = {
  status: ConnectivityStatus;
  since: number;
  reason?: OfflineReason;
};

// A short empty round trip to the API server (`GET`/`HEAD /ping`).
const PING_URL = `${env.apiUrl}/ping`;
const PING_TIMEOUT_MS = 5_000;
// While offline, check this often whether the server is back.
const RECHECK_MS = 30_000;
const CONFIRM_RECHECK_MS = 5_000;
const SERVER_FAILURE_THRESHOLD = 3;
// Android pauses a backgrounded app's network, and for a moment after it reopens the phone can
// report no connection and requests fail though nothing is wrong. Going offline in the background
// is ignored, and for this long after reopening (until the server first answers) it is checked
// again before it counts, so the offline sheet and chip don't flash up on every reopen.
const RESUME_SETTLE_MS = 5_000;

let state: Connectivity = { since: Date.now(), status: "unknown" };
// When the app last came back to the foreground; 0 once the server has answered since.
let resumedAt = 0;
let settleCheck: ReturnType<typeof setTimeout> | null = null;
let lastDeviceConnected: boolean | null = null;
const listeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();
let recheck: ReturnType<typeof setInterval> | null = null;
let started = false;
let probing: Promise<void> | null = null;
let serverFailures = 0;
let confirmRecheck: ReturnType<typeof setTimeout> | null = null;

function markServerFailure() {
  serverFailures += 1;
  if (serverFailures >= SERVER_FAILURE_THRESHOLD) {
    set("offline", "server_unreachable");
    return;
  }
  confirmRecheck ??= setTimeout(() => {
    confirmRecheck = null;
    void probe();
  }, CONFIRM_RECHECK_MS);
}

/**
 * True when going offline now shouldn't count: the app is in the background, or it has only just
 * reopened (the server is then asked again once the network has settled).
 */
function holdOffline() {
  const app = AppState.currentState;
  if (app === "background" || app === "inactive") return true;
  const wait = resumedAt + RESUME_SETTLE_MS - Date.now();
  if (wait <= 0) return false;
  settleCheck ??= setTimeout(() => {
    settleCheck = null;
    void probe();
  }, wait);
  return true;
}

function set(status: ConnectivityStatus, reason?: OfflineReason) {
  // Only the change into offline is held; one already shown stays until the server answers.
  if (status === "offline" && state.status !== "offline" && holdOffline()) return;
  // The server answered: the network has settled, and a failure from now on is real.
  if (status === "online") {
    resumedAt = 0;
    if (settleCheck) clearTimeout(settleCheck);
    settleCheck = null;
  }
  const resolvedReason =
    status === "offline"
      ? (reason ?? (lastDeviceConnected === false ? "no_network" : "server_unreachable"))
      : undefined;

  if (state.status === status && state.reason === resolvedReason) return;
  const was = state.status;
  state = { reason: resolvedReason, since: Date.now(), status };
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
  lastDeviceConnected = true;
  serverFailures = 0;
  if (confirmRecheck) clearTimeout(confirmRecheck);
  confirmRecheck = null;
  set("online");
}

/** A request couldn't reach the server (no network, timeout, a captive portal). */
export function reportUnreachable(reason?: OfflineReason) {
  if (reason === "no_network") {
    set("offline", reason);
    return;
  }
  if (reason === "server_unreachable") markServerFailure();
  else {
    void Network.getNetworkStateAsync()
      .then((net) => {
        if (net.isConnected === false) {
          lastDeviceConnected = false;
          set("offline", "no_network");
        } else {
          lastDeviceConnected = true;
          markServerFailure();
        }
      })
      .catch(markServerFailure);
  }
}

/** Asks the server directly; the answer settles the status. */
export function probe(): Promise<void> {
  probing ??= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      const net = await Network.getNetworkStateAsync().catch(() => null);
      if (net) {
        lastDeviceConnected = net.isConnected !== false;
        if (net.isConnected === false) {
          set("offline", "no_network");
          return;
        }
      }
      const response = await fetch(PING_URL, { method: "HEAD", signal: controller.signal });
      if (response.ok) {
        lastDeviceConnected = true;
        set("online");
      } else {
        markServerFailure();
      }
    } catch {
      const net = await Network.getNetworkStateAsync().catch(() => null);
      if (net && net.isConnected === false) {
        lastDeviceConnected = false;
        set("offline", "no_network");
      } else {
        markServerFailure();
      }
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
  void Network.getNetworkStateAsync()
    .then((net) => {
      lastDeviceConnected = net.isConnected !== false;
    })
    .catch(() => undefined);
  Network.addNetworkStateListener((network) => {
    // No connection at all is certain. `isInternetReachable` isn't: it can flip false for a
    // moment on its own (switching towers, dual SIM, a VPN settling), so that gets confirmed
    // against the server rather than taken as offline on the spot.
    lastDeviceConnected = network.isConnected !== false;
    if (network.isConnected === false) set("offline", "no_network");
    else void probe();
  });
  AppState.addEventListener("change", (next) => {
    if (next !== "active") return;
    // Failures counted while in the background don't carry over into the reopened app.
    resumedAt = Date.now();
    serverFailures = 0;
    void probe();
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

export function getConnectivity(): Connectivity {
  return state;
}

export function useConnectivity() {
  return useSyncExternalStore(subscribe, () => state);
}
