/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <forced> */
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  type LayoutChangeEvent,
  PanResponder,
  View,
} from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { haptic } from "@/lib/haptics";

// Square thumb inset evenly inside the track.
const THUMB = 40;
const INSET = 6;
// The thumb must be dragged to the end of the track (within this many points) to submit.
const END_TOLERANCE = 6;
// While idle the thumb nudges right this far, then rests, hinting that it should be dragged.
const NUDGE = 8;
// The drag ticks as the thumb crosses each of these steps along the track, like detents.
const HAPTIC_STEPS = 4;

interface SwipeAttendanceProps {
  /** The thumb stays at the end, with a spinner, until the returned promise settles. */
  action: () => void | Promise<unknown>;
  busy: boolean;
  disabled?: boolean;
  /** Replaces "Swipe to Check In/Out", e.g. to say why the button is disabled. */
  label?: string;
  mode: "in" | "out";
}

export function SwipeAttendance({
  action,
  busy,
  disabled,
  label: override,
  mode: currentMode,
}: SwipeAttendanceProps) {
  const x = useRef(new Animated.Value(0)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  // The mode the thumb was swiped in, while it is held at the end. A check in flips the parent
  // to "out" before the action settles; the swipe keeps saying "Checking you in" until it does.
  const [held, setHeld] = useState<SwipeAttendanceProps["mode"] | null>(null);
  const mode = held ?? currentMode;
  const [dragging, setDragging] = useState(false);
  const [travel, setTravel] = useState(0);
  // The responder is created once, so it reads the latest props and track size through this ref.
  const latest = useRef({ action, busy, disabled, mode, travel });
  // Last step ticked and whether the thumb sits at the end, so each fires once per crossing.
  const feel = useRef({ armed: false, step: 0 });
  // From the moment the thumb lands at the end until the action has finished.
  const working = busy || held !== null;
  useEffect(() => {
    latest.current = { action, busy: working, disabled, mode, travel };
  }, [action, working, disabled, mode, travel]);
  const accent = mode === "in" ? colors.primary : colors.checkOut;
  const label = override ?? (mode === "in" ? "Swipe to Check In" : "Swipe to Check Out");
  const reset = () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
  const idle = !(working || disabled || dragging) && travel > 0;
  useEffect(() => {
    if (!idle) {
      nudge.stopAnimation();
      nudge.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(nudge, {
          duration: 280,
          easing: Easing.out(Easing.quad),
          toValue: NUDGE,
          useNativeDriver: true,
        }),
        Animated.timing(nudge, {
          duration: 380,
          easing: Easing.bounce,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [idle, nudge]);
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        !latest.current.disabled &&
        !latest.current.busy &&
        latest.current.travel > 0 &&
        Math.abs(gesture.dx) > 4,
      // Keep the drag even if the page's ScrollView wants it.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        feel.current = { armed: false, step: 0 };
        haptic("light");
        setDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        const { travel: end } = latest.current;
        const position = Math.max(0, Math.min(end, gesture.dx));
        x.setValue(position);
        const armed = gesture.dx >= end - END_TOLERANCE;
        const step = Math.min(HAPTIC_STEPS - 1, Math.floor((position / end) * HAPTIC_STEPS));
        // A firm click once the thumb reaches the end (letting go now submits); lighter ticks
        // while it travels, in either direction.
        if (armed && !feel.current.armed) haptic("heavy");
        else if (!armed && step !== feel.current.step) haptic("selection");
        feel.current = { armed, step };
      },
      onPanResponderRelease: (_, gesture) => {
        setDragging(false);
        const { travel: end } = latest.current;
        if (gesture.dx >= end - END_TOLERANCE) {
          Animated.timing(x, { duration: 120, toValue: end, useNativeDriver: true }).start(() => {
            setHeld(latest.current.mode);
            // Held at the end until the whole action (checks, photo, request) has finished.
            void Promise.resolve(latest.current.action())
              .catch(() => undefined)
              .finally(() => {
                setHeld(null);
                reset();
              });
          });
        } else {
          // Let go too early: a soft bump as the thumb springs back.
          haptic("toggle-off");
          reset();
        }
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        reset();
      },
    }),
  ).current;
  const onTrackLayout = (event: LayoutChangeEvent) =>
    setTravel(Math.max(0, event.nativeEvent.layout.width - THUMB - INSET * 2));
  // The label fades as the thumb slides over it.
  const labelOpacity = travel
    ? x.interpolate({ extrapolate: "clamp", inputRange: [0, travel * 0.6], outputRange: [1, 0.2] })
    : 1;
  return (
    <View
      className={`h-[52px] justify-center ${disabled ? "opacity-50" : ""}`}
      onLayout={onTrackLayout}
      style={{ backgroundColor: accent, paddingHorizontal: INSET }}
    >
      <Animated.View
        className="absolute inset-y-0 right-0 items-center justify-center px-2"
        // Centred in the track to the right of the thumb, so long labels never run under it.
        style={{ left: THUMB + INSET, opacity: labelOpacity }}
      >
        <Text className="text-base text-white" numberOfLines={1}>
          {working ? (mode === "in" ? "Checking you in" : "Checking you out") : label}
        </Text>
      </Animated.View>
      <Animated.View
        {...responder.panHandlers}
        className="items-center justify-center bg-white"
        style={{ height: THUMB, transform: [{ translateX: Animated.add(x, nudge) }], width: THUMB }}
      >
        {working ? (
          <ActivityIndicator color={accent} size="small" />
        ) : (
          <HugeiconsIcon color={accent} icon={ArrowRight02Icon} size={22} strokeWidth={1.8} />
        )}
      </Animated.View>
    </View>
  );
}
