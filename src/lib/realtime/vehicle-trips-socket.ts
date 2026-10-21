import { io, type Socket } from "socket.io-client";

import type { LiveTripOrder, LiveTripPoint } from "@/lib/api/live-trips";
import { env } from "@/lib/env";

export type TripOpenedEvent = { tripId: string; drsId: string | null; deliveryBoyId: string };
export type TripProgressEvent = {
  tripId: string;
  drsId: string | null;
  at: string;
  lastPoint: LiveTripPoint | null;
  orders: LiveTripOrder[];
};
export type TripClosedEvent = { tripId: string; endedAt: string };
export type TripPointEvent = {
  tripId: string;
  point: LiveTripPoint & { id: string; address: string | null };
};

type FeedHandlers = {
  /** Connected, or reconnected after a drop: whatever was missed meanwhile needs a reload. */
  onConnect: () => void;
  onOpened: (event: TripOpenedEvent) => void;
  onProgress: (event: TripProgressEvent) => void;
  onClosed: (event: TripClosedEvent) => void;
};

const NAMESPACE = `${env.apiUrl}/vehicle-trips`;

/**
 * The organisation's live trips as they open, move and close, pushed by the server. Without a
 * trip id the server joins this socket to the member's own trips and, with order view, to
 * every trip in the organisation. Returns the disconnect.
 */
export function connectTripFeed(token: string, handlers: FeedHandlers): () => void {
  const socket: Socket = io(NAMESPACE, {
    auth: { token },
    reconnectionDelayMax: 30_000,
    transports: ["websocket"],
  });
  socket.on("connect", handlers.onConnect);
  socket.on("trip.opened", handlers.onOpened);
  socket.on("trip.progress", handlers.onProgress);
  socket.on("trip.closed", handlers.onClosed);
  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}

/** One trip's GPS points as they arrive (the trip map). Returns the disconnect. */
export function connectTripChannel(
  token: string,
  tripId: string,
  handlers: {
    onPoint: (event: TripPointEvent) => void;
    onProgress: (event: TripProgressEvent) => void;
    onEnded: () => void;
  },
): () => void {
  const socket: Socket = io(NAMESPACE, {
    auth: { token, tripId },
    reconnectionDelayMax: 30_000,
    transports: ["websocket"],
  });
  socket.on("trip.point", handlers.onPoint);
  socket.on("trip.progress", handlers.onProgress);
  socket.on("trip.ended", handlers.onEnded);
  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}
