import { io, type Socket } from "socket.io-client";

import { reportRejectedToken } from "@/lib/auth/session-expiry";
import { env } from "@/lib/env";

import { SOCKET_TRANSPORTS } from "./vehicle-trips-socket";

/** Home data the server says went stale for this login. */
export type AppDataResource = "attendance" | "drs" | "orders";

type AppChangedEvent = { at: string; resources: AppDataResource[] };

type Listener = (resources: AppDataResource[]) => void;

const listeners = new Set<Listener>();

/** Called with the stale resources (and with all of them after a reconnect). */
export function onAppDataChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const ALL: AppDataResource[] = ["attendance", "drs", "orders"];

/**
 * The server's "your Home data changed" channel. It carries no data, only which cached
 * resource to reload; the reload goes through the usual queries. Returns the disconnect.
 */
export function connectAppData(token: string): () => void {
  const socket: Socket = io(`${env.apiUrl}/app-data`, {
    auth: { token },
    reconnectionDelayMax: 30_000,
    transports: SOCKET_TRANSPORTS,
  });
  let connectedBefore = false;
  socket.on("connect", () => {
    // A reconnect may have missed events: everything is reloaded once.
    if (connectedBefore) for (const listener of listeners) listener(ALL);
    connectedBefore = true;
  });
  // A sign-in on another phone ended this session: the session provider signs out.
  socket.on("session.replaced", () => reportRejectedToken(token, "replaced"));
  socket.on("app.changed", (event: AppChangedEvent) => {
    const resources = (event?.resources ?? []).filter((r): r is AppDataResource => ALL.includes(r));
    if (resources.length === 0) return;
    for (const listener of listeners) listener(resources);
  });
  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}
