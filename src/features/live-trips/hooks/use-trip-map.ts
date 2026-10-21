import { useEffect, useMemo, useState } from "react";

import type { TripStop } from "@/features/home/components/home-map";
import { fetchTripPath, type LiveTrip, type LiveTripPoint } from "@/lib/api/live-trips";
import { useAuthSession } from "@/lib/auth/session";
import type { Coordinates } from "@/lib/maps/geo";
import { connectTripChannel } from "@/lib/realtime/vehicle-trips-socket";

import { applyTripProgress } from "../lib/live-trips-store";

const byTime = (a: LiveTripPoint, b: LiveTripPoint) =>
  Date.parse(a.recordedAt) - Date.parse(b.recordedAt);

/**
 * What a live trip's map draws, kept current over the trip's socket: the way driven so far, the
 * truck's position, and every order still to deliver. Shared by the full-screen trip map and the
 * Home map while a trip is live. `own` is this phone's position, which places the truck for the
 * driver before the first point reaches the server.
 */
export function useTripMap(trip: LiveTrip | null, own: Coordinates | null) {
  const { token } = useAuthSession();
  const tripId = trip?.id ?? null;
  const drsId = trip?.drsId ?? null;
  const [path, setPath] = useState<LiveTripPoint[]>([]);
  const [ended, setEnded] = useState(false);

  // The way driven so far once, then each new point as the server pushes it.
  useEffect(() => {
    setPath([]);
    setEnded(false);
    if (!(token && tripId && drsId)) return;
    let current = true;
    const add = (points: LiveTripPoint[]) =>
      setPath((previous) => {
        const seen = new Set(previous.map((point) => point.recordedAt));
        const fresh = points.filter((point) => !seen.has(point.recordedAt));
        return fresh.length ? [...previous, ...fresh].sort(byTime) : previous;
      });
    fetchTripPath(token, drsId)
      .then((points) => {
        if (current) add(points);
      })
      .catch(() => undefined);
    const disconnect = connectTripChannel(token, tripId, {
      onEnded: () => {
        if (current) setEnded(true);
      },
      onPoint: (event) => {
        if (current) add([event.point]);
      },
      onProgress: applyTripProgress,
    });
    return () => {
      current = false;
      disconnect();
    };
  }, [drsId, token, tripId]);

  // Every order still to deliver on the sheet, so the whole run shows on the map.
  const orders = trip?.orders;
  const stops = useMemo(
    () =>
      (orders ?? []).flatMap((item): TripStop[] =>
        item.latitude != null && item.longitude != null
          ? [
              {
                address: item.address,
                id: item.orderId,
                latitude: item.latitude,
                longitude: item.longitude,
                title: `${item.receiverName ?? "Receiver"} · AWB ${item.awbNo}`,
              },
            ]
          : [],
      ),
    [orders],
  );
  const shownPath = useMemo(
    () => path.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
    [path],
  );
  // Where the truck is: its latest point; before the first one reaches the server, the trip's
  // last known point, or for the driver their own phone's position.
  const lastPoint = trip?.lastPoint;
  const mine = Boolean(trip?.mine);
  const vehicle = useMemo(() => {
    const latest = shownPath.at(-1) ?? lastPoint;
    if (latest) return { latitude: latest.latitude, longitude: latest.longitude };
    return mine ? own : null;
  }, [lastPoint, mine, own, shownPath]);

  return { ended, path: shownPath, stops, vehicle };
}
