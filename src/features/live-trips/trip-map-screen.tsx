import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/modules/typography";
import { LiveTripMap } from "@/features/home/components/home-map";
import { fetchTripPath, type LiveTripPoint } from "@/lib/api/live-trips";
import { useAuthSession } from "@/lib/auth/session";
import { connectTripChannel } from "@/lib/realtime/vehicle-trips-socket";

import { LiveTripCard } from "./components/live-trip-card";
import { applyTripProgress, useLiveTrips } from "./lib/live-trips-store";

const byTime = (a: LiveTripPoint, b: LiveTripPoint) =>
  Date.parse(a.recordedAt) - Date.parse(b.recordedAt);

/**
 * One live trip on the map, following the vehicle as its points arrive over the trip's socket:
 * the way it has come, the truck, the order picked on Home and the road to it, with that order's
 * distance card along the bottom.
 */
export function TripMapScreen() {
  const { orderId, tripId } = useLocalSearchParams<{ orderId?: string; tripId: string }>();
  const { token } = useAuthSession();
  const insets = useSafeAreaInsets();
  const trip = useLiveTrips().trips.find((item) => item.id === tripId) ?? null;
  const drsId = trip?.drsId ?? null;
  const [path, setPath] = useState<LiveTripPoint[]>([]);
  const [ended, setEnded] = useState(false);

  // The way driven so far once, then each new point as the server pushes it.
  useEffect(() => {
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

  // The order picked on Home; once it is delivered, the nearest one still pending.
  const order = trip?.orders.find((item) => item.orderId === orderId) ?? trip?.orders[0] ?? null;
  const destination = useMemo(
    () =>
      order?.latitude != null && order.longitude != null
        ? {
            address: order.address,
            latitude: order.latitude,
            longitude: order.longitude,
            title: order.receiverName ?? `AWB ${order.awbNo}`,
          }
        : null,
    [order],
  );
  // Before the path loads, the trip's latest point still places the truck.
  const shownPath = useMemo(
    () =>
      (path.length ? path : trip?.lastPoint ? [trip.lastPoint] : []).map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [path, trip?.lastPoint],
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View className="flex-1 bg-accent">
      <LiveTripMap
        controlsTop={insets.top + 12}
        destination={destination}
        legendBottom={insets.bottom + 180}
        onClose={close}
        path={shownPath}
      />
      <View className="absolute right-4 left-4" style={{ bottom: insets.bottom + 16 }}>
        {trip && order && !ended ? (
          <LiveTripCard onMap order={order} trip={trip} />
        ) : (
          <View className="border border-[#E6E9F8] bg-card px-4 py-4">
            <Text className="text-lg font-semibold text-foreground">Trip ended</Text>
            <Text className="mt-1 text-base text-muted-foreground">
              Every order on this trip has been settled.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
