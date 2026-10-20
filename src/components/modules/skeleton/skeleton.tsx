import { useEffect } from "react";
import {
  type DimensionValue,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// One slow breath (dim → bright → dim), the same for every block so they pulse together.
const PULSE_MS = 900;
const FILL = "#E9ECF5";

/**
 * A placeholder block in the shape of content that is still loading, gently pulsing. Give it the
 * size of what replaces it, so nothing moves when the content arrives. Always square-cornered,
 * like the rest of the app, even where the real content is round (an avatar, the swipe button).
 */
export function Skeleton({
  className = "",
  height,
  style,
  width,
}: {
  className?: string;
  height?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
}) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.45, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  // NativeWind styles only core views: the outer one takes `className` (margins, flex), the
  // animated fill inside is styled inline.
  return (
    <View
      accessibilityElementsHidden
      className={className}
      importantForAccessibility="no-hide-descendants"
      style={[{ height, width }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: FILL }, pulse]} />
    </View>
  );
}
