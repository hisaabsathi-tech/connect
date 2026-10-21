import { ArrowRight01Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { openDrsOrder } from "@/features/orders/lib/open-order";
import type { LiveTrip, LiveTripOrder } from "@/lib/api/live-trips";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { type TrackingStatus, useTrackingStatus } from "@/lib/tracking/status";

import { formatDistance } from "../lib/format";
import { nextStopOf, useNextStopPicks } from "../lib/next-stop";
import { NextStopSheet } from "./next-stop-sheet";

// What the driver has to switch on before the first point can be sent.
const blockedCopy: Record<NonNullable<TrackingStatus["blocked"]>, string> = {
  background: "Set location to “Allow all the time” to start live tracking",
  permission: "Allow location to start live tracking",
  services: "Turn on your phone's location to start live tracking",
};

const truck = require("@/assets/map-pin/truck.webp");

// The truck artwork (140×342) faces up; turned a quarter it drives left to right along the bar.
const TRUCK_LENGTH = 56;
const TRUCK_WIDTH = Math.round((TRUCK_LENGTH * 140) / 342);
const PIN = 44;
const BAR = 10;
const EASE = { duration: 600, easing: Easing.out(Easing.cubic) };
// Closer than this the rider is at the door.
const ARRIVING_METRES = 150;

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
          {
            height: TRUCK_LENGTH,
            top: (PIN - TRUCK_LENGTH) / 2,
            width: TRUCK_LENGTH,
          },
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

function Headline({
  blocked,
  driver,
  order,
}: {
  /** The driver's own phone can't report yet (only set on the driver's card). */
  blocked: TrackingStatus["blocked"];
  driver: string | null;
  order: LiveTripOrder;
}) {
  const who = driver ? `${driver} is` : "You are";
  if (order.remainingMeters == null)
    return (
      <Text
        className={`mt-1 text-base leading-6 ${blocked ? "text-destructive" : "text-muted-foreground"}`}
      >
        {blocked ? blockedCopy[blocked] : "Waiting for the vehicle's location…"}
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
  const { blocked } = useTrackingStatus();
  const { token } = useAuthSession();
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const [choosing, setChoosing] = useState(false);
  // The driver can open the next stop's order: the parcel scan first, then its update page.
  const canOpen = trip.mine && Boolean(trip.drsId && token);
  const openOrder = async () => {
    if (!(canOpen && token && trip.drsId) || opening) return;
    haptic("light");
    setOpening(true);
    try {
      await openDrsOrder(token, trip.drsId, order.orderId);
    } catch (error) {
      toast.error("Couldn't open the order", errorMessage(error, "Please try again."));
    } finally {
      setOpening(false);
    }
  };
  // With several orders out, the block follows the next stop and says how many are left.
  const left = trip.orders.length;
  // Someone else's trip names who is driving it too; your own just names the vehicle.
  const vehicleNo = trip.vehicleNo?.trim();
  const crew = [
    trip.mine ? null : trip.deliveryBoyName?.trim(),
    vehicleNo ? `Vehicle No: ${vehicleNo}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
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
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-lg font-semibold leading-6 text-foreground">
          Tracking in Progress
        </Text>
        {/* How many deliveries the sheet still has, the next stop included. */}
        <View className="h-6 flex-row items-center bg-accent px-2">
          <Text className="text-xs font-medium text-primary">
            {left} {left === 1 ? "order" : "orders"}
          </Text>
        </View>
      </View>
      {crew ? (
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {crew}
        </Text>
      ) : null}
      <Headline blocked={trip.mine ? blocked : null} driver={driver} order={order} />
      {/* The order the distance is measured to, on its own so its AWB reads at a glance. */}
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-[11px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
          {left > 1 ? "Next stop" : "Destination"}
        </Text>
        {/* The driver may head somewhere other than the nearest order. */}
        {trip.mine && left > 1 ? (
          <Pressable
            accessibilityHint="Pick which order to go to next"
            accessibilityRole="button"
            className="-my-2 py-2 pl-3"
            hitSlop={8}
            onPress={() => {
              haptic("light");
              setChoosing(true);
            }}
          >
            <Text className="text-sm font-medium text-primary">Change</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityHint={canOpen ? "Scans this order's parcel, then opens it" : undefined}
        accessibilityRole={canOpen ? "button" : undefined}
        className="mt-1.5 flex-row items-center justify-between gap-3 border border-[#E6E9F8] bg-[#F6F7FF] px-3 py-2.5 active:bg-accent"
        disabled={!canOpen || opening}
        onPress={() => void openOrder()}
      >
        <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
          {order.awbNo}
        </Text>
        {order.receiverName ? (
          <Text className="max-w-[45%] text-right text-sm text-muted-foreground" numberOfLines={2}>
            {order.receiverName}
          </Text>
        ) : null}
        {canOpen ? (
          opening ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <HugeiconsIcon color={colors.primary} icon={ArrowRight01Icon} size={18} />
          )
        ) : null}
      </Pressable>
      <TripProgressBar progress={order.progress ?? 0} />
      <NextStopSheet onClose={() => setChoosing(false)} trip={choosing ? trip : null} />
    </Pressable>
  );
}

/**
 * One block per live trip (DRS), however many orders it carries: the next stop, i.e. the order
 * the driver picked or else the nearest one still pending. Once it is delivered the block moves
 * on to the next one, and it goes when the last is done.
 */
export function LiveTripBlocks({ trips }: { trips: LiveTrip[] }) {
  const picks = useNextStopPicks();
  return (
    <View className="gap-2">
      {trips.map((trip) => {
        const next = nextStopOf(trip, picks);
        return next ? <LiveTripCard key={trip.id} order={next} trip={trip} /> : null;
      })}
    </View>
  );
}
