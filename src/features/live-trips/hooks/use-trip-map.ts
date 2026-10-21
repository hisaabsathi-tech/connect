import { useEffect, useMemo, useState } from "react";

import type { TripStop } from "@/features/home/components/home-map";
import {
  fetchTripPath,
  type LiveTrip,
  mergeTripPath,
  type TripPathPoint,
} from "@/lib/api/live-trips";
import { useAuthSession } from "@/lib/auth/session";
import { type Coordinates, simplifyForDisplay } from "@/lib/maps/geo";
import { connectTripChannel } from "@/lib/realtime/vehicle-trips-socket";

import { applyTripProgress, newerPoint } from "../lib/live-trips-store";

/**
 * What a live trip's map draws, kept current over the trip's socket: the Start pin, the way driven
 * so far, the truck's position, and every order still to deliver. Shared by the full-screen trip
 * map and the Home map while a trip is live. `own` is this phone's position, which places the
 * truck for the driver before the first point reaches the server.
 */
export function useTripMap(trip: LiveTrip | null, own: Coordinates | null) {
  const { token } = useAuthSession();
  const tripId = trip?.id ?? null;
  const drsId = trip?.drsId ?? null;
  const [path, setPath] = useState<TripPathPoint[]>([]);
  const [ended, setEnded] = useState(false);

  // The whole way driven (every page) on each (re)connect, then each new point as it is pushed.
  // Points merge by id, so a replayed or resent point is never drawn twice.
  useEffect(() => {
    setPath([]);
    setEnded(false);
    if (!(token && tripId && drsId)) return;
    let current = true;
    let loading = false;
    const add = (points: TripPathPoint[]) =>
      setPath((previous) => (points.length ? mergeTripPath(previous, points) : previous));
    const load = () => {
      if (loading) return;
      loading = true;
      fetchTripPath(token, drsId)
        .then((points) => {
          if (current) add(points);
        })
        .catch(() => undefined)
        .finally(() => {
          loading = false;
        });
    };
    load();
    const disconnect = connectTripChannel(token, tripId, {
      onConnect: load,
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
  // Long trips are thinned for drawing only; the raw points stay as they are.
  const shownPath = useMemo(
    () =>
      simplifyForDisplay(path).map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [path],
  );
  // Where the truck is: whichever is newer of the latest path point and the snapshot's last
  // point (a reconnect can bring either first); before any, the driver's own phone.
  const lastPoint = trip?.lastPoint ?? null;
  const mine = Boolean(trip?.mine);
  const newest = path.at(-1) ?? null;
  const vehicle = useMemo(() => {
    const latest = newerPoint(newest, lastPoint);
    if (latest) return { latitude: latest.latitude, longitude: latest.longitude };
    return mine ? own : null;
  }, [lastPoint, mine, newest, own]);
  // The trip's earliest GPS fix, from the snapshot or the first point of the path; nothing is
  // made up before the first fix exists.
  const startPoint = trip?.startPoint ?? null;
  const first = path[0] ?? null;
  const start = useMemo(() => {
    const earliest =
      startPoint && first
        ? Date.parse(startPoint.recordedAt) <= Date.parse(first.recordedAt)
          ? startPoint
          : first
        : (startPoint ?? first);
    return earliest ? { latitude: earliest.latitude, longitude: earliest.longitude } : null;
  }, [first, startPoint]);

  return { ended, path: shownPath, start, stops, vehicle };
}
