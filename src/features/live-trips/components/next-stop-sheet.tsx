import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable, ScrollView, View } from "react-native";

import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { LiveTrip } from "@/lib/api/live-trips";
import { haptic } from "@/lib/haptics";

import { formatDistance } from "../lib/format";
import { chooseNextStop, isChosenStop, nextStopOf, useNextStopPicks } from "../lib/next-stop";

function Option({
  detail,
  onPress,
  selected,
  title,
}: {
  detail: string | null;
  onPress: () => void;
  selected: boolean;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className={`flex-row items-center gap-3 border px-4 py-3 ${selected ? "border-primary bg-accent" : "border-border bg-card active:bg-[#F3F5FF]"}`}
      onPress={onPress}
    >
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <HugeiconsIcon color={colors.primary} icon={CheckmarkCircle02Icon} size={22} />
      ) : (
        <View className="h-5 w-5 rounded-full border-2 border-border" />
      )}
    </Pressable>
  );
}

/**
 * Lets the driver pick which order on the trip to go to next, instead of the nearest one. The
 * card, its distance and the predicted path follow the choice; "Nearest first" hands it back.
 */
export function NextStopSheet({
  onClose,
  trip,
}: {
  onClose: () => void;
  /** The trip to choose for; the sheet shows while set. */
  trip: LiveTrip | null;
}) {
  const picks = useNextStopPicks();
  const chosen = trip ? isChosenStop(trip, picks) : false;
  const current = trip ? nextStopOf(trip, picks) : null;
  const pick = (orderId: string | null) => {
    if (!trip) return;
    haptic("selection");
    chooseNextStop(trip.id, orderId);
    onClose();
  };
  return (
    <BottomSheet dragHandleOnly onClose={onClose} visible={trip !== null}>
      <Text className="mt-4 text-xl font-semibold leading-7 text-foreground">Choose next stop</Text>
      <Text className="mt-0.5 text-sm text-muted-foreground">
        The order you're heading to now; the distance and route follow it.
      </Text>
      <ScrollView className="mt-4 max-h-[420px]" contentContainerClassName="gap-2">
        <Option
          detail="Always the closest order still to deliver"
          onPress={() => pick(null)}
          selected={!chosen}
          title="Nearest first (automatic)"
        />
        {(trip?.orders ?? []).map((order) => {
          const distance =
            order.remainingMeters == null
              ? null
              : `${formatDistance(order.remainingMeters, order.estimated)} away`;
          return (
            <Option
              detail={[order.receiverName, distance, order.address].filter(Boolean).join(" · ")}
              key={order.orderId}
              onPress={() => pick(order.orderId)}
              selected={chosen && current?.orderId === order.orderId}
              title={`AWB ${order.awbNo}`}
            />
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
