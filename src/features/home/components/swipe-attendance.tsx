import { ArrowRight02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
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

// Square thumb inset evenly inside the track.
const THUMB = 40;
const INSET = 6;
// The thumb must be dragged to the end of the track (within this many points) to submit.
const END_TOLERANCE = 6;
// While idle the thumb nudges right this far, then rests, hinting that it should be dragged.
const NUDGE = 8;

interface SwipeAttendanceProps {
  action: () => void;
  busy: boolean;
  disabled?: boolean;
  mode: "in" | "out";
}

export function SwipeAttendance({ action, busy, disabled, mode }: SwipeAttendanceProps) {
  const x = useRef(new Animated.Value(0)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const [complete, setComplete] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [travel, setTravel] = useState(0);
  // The responder is created once, so it reads the latest props and track size through this ref.
  const latest = useRef({ action, busy, disabled, travel });
  useEffect(() => {
    latest.current = { action, busy, disabled, travel };
  }, [action, busy, disabled, travel]);
  const accent = mode === "in" ? colors.primary : colors.checkOut;
  const label = mode === "in" ? "Swipe to Check In" : "Swipe to Check Out";
  const reset = () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
  useEffect(() => {
    if (!busy && complete) {
      setComplete(false);
      reset();
    }
  }, [busy, complete]);
  const idle = !(busy || disabled || complete || dragging) && travel > 0;
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
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: (_, gesture) =>
        x.setValue(Math.max(0, Math.min(latest.current.travel, gesture.dx))),
      onPanResponderRelease: (_, gesture) => {
        setDragging(false);
        const { travel: end } = latest.current;
        if (gesture.dx >= end - END_TOLERANCE) {
          Animated.timing(x, { duration: 120, toValue: end, useNativeDriver: true }).start(() => {
            setComplete(true);
            latest.current.action();
          });
        } else reset();
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
        className="absolute inset-0 items-center justify-center"
        style={{ opacity: labelOpacity }}
      >
        <Text className="text-base text-white">{busy ? "Saving attendance…" : label}</Text>
      </Animated.View>
      <Animated.View
        {...responder.panHandlers}
        className="items-center justify-center bg-white"
        style={{ height: THUMB, transform: [{ translateX: Animated.add(x, nudge) }], width: THUMB }}
      >
        {busy ? (
          <ActivityIndicator color={accent} size="small" />
        ) : (
          <HugeiconsIcon
            color={accent}
            icon={complete ? CheckmarkCircle02Icon : ArrowRight02Icon}
            size={22}
            strokeWidth={1.8}
          />
        )}
      </Animated.View>
    </View>
  );
}
