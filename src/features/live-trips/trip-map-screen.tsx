import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/modules/typography";
import { LiveTripMap } from "@/features/home/components/home-map";
import { useLiveLocation } from "@/hooks/use-live-location";

import { LiveTripCard } from "./components/live-trip-card";
import { useTripMap } from "./hooks/use-trip-map";
import { useLiveTrips } from "./lib/live-trips-store";

/**
 * One live trip on the map, following the vehicle as its points arrive over the trip's socket:
 * the way it has come, the truck, the order picked on Home and the road to it, with that order's
 * distance card along the bottom.
 */
export function TripMapScreen() {
  const { orderId, tripId } = useLocalSearchParams<{ orderId?: string; tripId: string }>();
  const insets = useSafeAreaInsets();
  const trip = useLiveTrips().trips.find((item) => item.id === tripId) ?? null;
  // The order picked on Home; once it is delivered, the nearest one still pending.
  const order = trip?.orders.find((item) => item.orderId === orderId) ?? trip?.orders[0] ?? null;
  const own = useLiveLocation(Boolean(trip?.mine));
  const { ended, path, stops, vehicle } = useTripMap(trip, own.location);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View className="flex-1 bg-accent">
      <LiveTripMap
        controlsTop={insets.top + 12}
        legendBottom={insets.bottom + 180}
        onAction={close}
        path={path}
        stops={stops}
        vehicle={vehicle}
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
