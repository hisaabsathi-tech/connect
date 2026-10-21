import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/modules/typography";
import { vehiclePinFor } from "@/config/vehicle-pins";
import { LiveTripMap } from "@/features/home/components/home-map";
import { useLiveLocation } from "@/hooks/use-live-location";
import { useConnectivity } from "@/lib/network/connectivity";

import { LiveTripCard } from "./components/live-trip-card";
import { useTripMap } from "./hooks/use-trip-map";
import { useLiveTrips } from "./lib/live-trips-store";
import { nextStopOf, useNextStopPicks } from "./lib/next-stop";

const CARD_BOTTOM = 16;
const CARD_GAP = 12;
// Used only for the first frame, before React Native reports the card's actual height.
const INITIAL_CARD_HEIGHT = 180;

/**
 * One live trip on the map, following the vehicle as its points arrive over the trip's socket:
 * the way it has come, the truck, the order picked on Home and the road to it, with that order's
 * distance card along the bottom.
 */
export function TripMapScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const { synced, trips } = useLiveTrips();
  const trip = trips.find((item) => item.id === tripId) ?? null;
  const { status } = useConnectivity();
  // A trip missing from a list the server didn't confirm (offline) isn't over, only unknown.
  const waiting = !trip && (status === "offline" || !synced);
  // The trip's next stop: the order the driver picked, or else the nearest one still pending.
  const picks = useNextStopPicks();
  const order = trip ? nextStopOf(trip, picks) : null;
  const own = useLiveLocation(Boolean(trip?.mine));
  const { ended, path, stops, vehicle } = useTripMap(trip, own.location);
  const [cardHeight, setCardHeight] = useState(INITIAL_CARD_HEIGHT);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View className="flex-1 bg-accent">
      <LiveTripMap
        bearing={trip?.mine ? own.heading : undefined}
        controlsTop={insets.top + 12}
        legendBottom={insets.bottom + CARD_BOTTOM + cardHeight + CARD_GAP}
        nextStopId={order?.orderId ?? null}
        onAction={close}
        path={path}
        stops={stops}
        vehicle={vehicle}
        vehiclePin={vehiclePinFor(trip?.vehicleWheelCount)}
      />
      <View
        className="absolute right-4 left-4"
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
        style={{ bottom: insets.bottom + CARD_BOTTOM }}
      >
        {trip && order && !ended ? (
          <LiveTripCard onMap order={order} trip={trip} />
        ) : (
          <View className="border border-[#E6E9F8] bg-card px-4 py-4">
            <Text className="text-lg font-semibold text-foreground">
              {waiting ? "Waiting for connection" : "Trip ended"}
            </Text>
            <Text className="mt-1 text-base text-muted-foreground">
              {waiting
                ? "This trip shows here as soon as the app is back online."
                : "Every order on this trip has been settled."}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
