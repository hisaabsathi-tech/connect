import { LocationOffline03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { colors } from "@/config/colors";
import type { LiveLocation } from "@/hooks/use-live-location";
import { haptic } from "@/lib/haptics";

/**
 * - `off`: no permission, or the device's location is switched off
 * - `on`: location is available
 * - `active`: location is being read right now (continuously during a live delivery trip)
 */
export type LocationIndicatorState = "off" | "on" | "active";

// Every state takes this footprint (`h-12 w-12`), so the header never shifts.
const SIZE = 48;
// While active the green circle is smaller (`h-10 w-10`): the ripple around it fills the rest.
const ACTIVE_CIRCLE = 40;
// Ripples start at the green circle's edge and fade out at the avatar's 52pt row height, so the
// header's scroll view never clips them.
const RIPPLE_FROM = ACTIVE_CIRCLE / SIZE;
const RIPPLE_TO = 52 / SIZE;
const RIPPLE_MS = 1600;

const labels: Record<LocationIndicatorState, string> = {
  active: "Reading your location",
  off: "Location is off. Turn on location",
  on: "Location is on",
};

/** Hugeicons' Location06 shape, filled: the icon set itself only draws outlines. */
function FilledPin({ color }: { color: string }) {
  return (
    <Svg height={24} viewBox="0 0 24 24" width={24}>
      <Path
        d="M12 2C16.8706 2 21 6.03298 21 10.9258C21 15.8965 16.8033 19.3847 12.927 21.7567C12.6445 21.9162 12.325 22 12 22C11.675 22 11.3555 21.9162 11.073 21.7567C7.2039 19.3616 3 15.9137 3 10.9258C3 6.03298 7.12944 2 12 2Z"
        fill={color}
      />
      <Path
        d="M15.5 11C15.5 12.933 13.933 14.5 12 14.5C10.067 14.5 8.5 12.933 8.5 11C8.5 9.067 10.067 7.5 12 7.5C13.933 7.5 15.5 9.067 15.5 11Z"
        fill={colors.primaryForeground}
      />
    </Svg>
  );
}

/** One green ring spreading out from the circle and fading; `delay` staggers it. */
function RippleRing({ delay }: { delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - progress.value),
    transform: [{ scale: RIPPLE_FROM + progress.value * (RIPPLE_TO - RIPPLE_FROM) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ height: SIZE, position: "absolute", width: SIZE }, style]}
    >
      <View className="flex-1 rounded-full border-2 border-success" />
    </Animated.View>
  );
}

/**
 * Round header badge showing whether location is off, on, or being read. Only `off` is a button
 * (it asks for whatever is missing); the other two just show the state.
 */
export function LocationIndicator({
  onPress,
  state,
}: {
  /** Called on tap while `off`. */
  onPress: () => void;
  state: LocationIndicatorState;
}) {
  if (state === "off")
    return (
      <Pressable
        accessibilityLabel={labels.off}
        accessibilityRole="button"
        className="h-12 w-12 items-center justify-center rounded-full bg-accent"
        onPress={onPress}
        onPressIn={() => haptic("light")}
      >
        <HugeiconsIcon
          color={colors.mutedForeground}
          icon={LocationOffline03Icon}
          size={24}
          strokeWidth={1.5}
        />
      </Pressable>
    );
  return (
    <View accessibilityLabel={labels[state]} className="h-12 w-12 items-center justify-center">
      {state === "active" ? (
        <>
          <RippleRing delay={0} />
          <RippleRing delay={RIPPLE_MS / 2} />
          <View className="h-10 w-10 items-center justify-center rounded-full bg-success-soft">
            <FilledPin color={colors.success} />
          </View>
        </>
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
          <FilledPin color={colors.primary} />
        </View>
      )}
    </View>
  );
}

/**
 * What the location button shows; the one place that decides when each state appears. While a
 * live delivery trip is `tracking`, location is read continuously, so it ripples throughout.
 */
export function locationIndicatorState(
  { locating, status }: Pick<LiveLocation, "locating" | "status">,
  tracking = false,
): LocationIndicatorState {
  if (status === "denied" || status === "blocked" || status === "disabled") return "off";
  return tracking || locating || status === "checking" ? "active" : "on";
}
