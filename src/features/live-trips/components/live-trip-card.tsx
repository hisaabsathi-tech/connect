import { Location01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { LiveTrip, LiveTripOrder } from "@/lib/api/live-trips";

const truck = require("@/assets/map-pin/truck.webp");

// The truck artwork (140×342) faces up; turned a quarter it drives left to right along the bar.
const TRUCK_LENGTH = 56;
const TRUCK_WIDTH = Math.round((TRUCK_LENGTH * 140) / 342);
const PIN = 44;
const BAR = 10;
const EASE = { duration: 600, easing: Easing.out(Easing.cubic) };
// Closer than this the rider is at the door.
const ARRIVING_METRES = 150;

/** "850 m", "4.2 km", "12 km"; "~" marks a straight-line estimate. */
export function formatDistance(metres: number, estimated = false) {
  const value =
    metres < 1000
      ? `${Math.max(10, Math.round(metres / 10) * 10)} m`
      : `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
  return estimated ? `~${value}` : value;
}

/** The bar: the filled part is the way covered, the truck rides at its end, the pin waits. */
function TripProgressBar({ progress }: { progress: number }) {
  const [width, setWidth] = useState(0);
  const shown = useSharedValue(progress);
  useEffect(() => {
    shown.value = withTiming(Math.min(1, Math.max(0, progress)), EASE);
  }, [progress, shown]);
  // The bar runs under the pin's centre; the truck stops short of the pin.
  const track = Math.max(0, width - PIN / 2);
  const fillStyle = useAnimatedStyle(() => ({ width: shown.value * track }));
  const truckStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: Math.min(
          Math.max(0, shown.value * track - TRUCK_LENGTH + 8),
          Math.max(0, width - PIN - TRUCK_LENGTH),
        ),
      },
    ],
  }));
  return (
    <View
      className="mt-5"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: PIN }}
    >
      <View
        className="absolute left-0 overflow-hidden rounded-full bg-[#E5E7EB]"
        style={{ height: BAR, right: PIN / 2, top: (PIN - BAR) / 2 }}
      >
        <Animated.View className="h-full rounded-full bg-primary" style={fillStyle} />
      </View>
      <Animated.View
        className="absolute left-0 items-center justify-center"
        pointerEvents="none"
        style={[
          { height: TRUCK_LENGTH, top: (PIN - TRUCK_LENGTH) / 2, width: TRUCK_LENGTH },
          truckStyle,
        ]}
      >
        <Image
          contentFit="contain"
          source={truck}
          style={{
            height: TRUCK_LENGTH,
            transform: [{ rotate: "90deg" }],
            width: TRUCK_WIDTH,
          }}
        />
      </Animated.View>
      <View
        className="absolute top-0 right-0 items-center justify-center rounded-full bg-success"
        style={{ height: PIN, width: PIN }}
      >
        <HugeiconsIcon
          color={colors.primaryForeground}
          icon={Location01Icon}
          size={22}
          strokeWidth={1.8}
        />
      </View>
    </View>
  );
}

function Headline({ driver, order }: { driver: string | null; order: LiveTripOrder }) {
  const who = driver ? `${driver} is` : "You are";
  if (order.remainingMeters == null)
    return (
      <Text className="mt-1 text-base leading-6 text-muted-foreground">
        Waiting for the vehicle's location…
      </Text>
    );
  if (order.remainingMeters < ARRIVING_METRES)
    return (
      <Text className="mt-1 text-base leading-6 text-muted-foreground">
        {driver ? `${driver} has` : "You have"}{" "}
        <Text className="text-base font-medium text-success">almost arrived</Text> at the
        destination
      </Text>
    );
  return (
    <Text className="mt-1 text-base leading-6 text-muted-foreground">
      {who} about{" "}
      <Text className="text-base font-medium text-primary">
        {formatDistance(order.remainingMeters, order.estimated)}
      </Text>{" "}
      away from {driver ? "the" : "your"} destination
    </Text>
  );
}

/**
 * One order still to reach on a live trip: how far the vehicle is from it, as text and as the
 * truck's place on the bar. Updates in place as the server pushes new distances; tapping it
 * opens the trip on the map.
 */
export function LiveTripCard({
  order,
  trip,
  onMap = false,
}: {
  order: LiveTripOrder;
  trip: LiveTrip;
  /** Already on the trip's map: shown as a plain card, not a link to it. */
  onMap?: boolean;
}) {
  // The driver reads "You are …"; everyone else watching reads the driver's name.
  const driver = trip.mine ? null : trip.deliveryBoyName?.trim() || "The vehicle";
  // With several orders out, the block follows the next stop and says how many are left.
  const left = trip.orders.length;
  const facts = [
    left > 1 ? `Next stop · ${left} orders left` : null,
    order.receiverName,
    `AWB ${order.awbNo}`,
    trip.mine ? null : trip.vehicleNo,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityHint="Opens the live trip on the map"
      accessibilityRole="button"
      className="border border-[#E6E9F8] bg-card px-4 pt-4 pb-3 active:bg-[#F3F5FF]"
      disabled={onMap}
      onPress={() =>
        router.push({
          params: { orderId: order.orderId, tripId: trip.id },
          pathname: "/live-trip/[tripId]",
        })
      }
    >
      <Text className="text-lg font-semibold leading-6 text-foreground">Tracking in Progress</Text>
      <Headline driver={driver} order={order} />
      <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
        {facts.join(" · ")}
      </Text>
      <TripProgressBar progress={order.progress ?? 0} />
    </Pressable>
  );
}

/**
 * One block per live trip (DRS), however many orders it carries: the next stop, i.e. the nearest
 * order still pending (the server sends them nearest first). Once it is delivered the block moves
 * on to the next one, and it goes when the last is done.
 */
export function LiveTripBlocks({ trips }: { trips: LiveTrip[] }) {
  return (
    <View className="gap-2">
      {trips.map((trip) => {
        const next = trip.orders[0];
        return next ? <LiveTripCard key={trip.id} order={next} trip={trip} /> : null;
      })}
    </View>
  );
}
