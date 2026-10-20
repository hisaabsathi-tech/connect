import { Image } from "expo-image";
import { useEffect } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const MAX_SCALE = 4;
// Double tap zooms to this, or back to fit when already zoomed.
const DOUBLE_TAP_SCALE = 2.5;

interface ZoomableImageProps {
  uri: string;
  accessibilityLabel: string;
}

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

/**
 * A photo that fills its block (whole picture visible), with pinch to zoom up to 4x, drag to
 * move while zoomed, and double tap to zoom in or back out. It never pans past its edges.
 * Needs a `GestureHandlerRootView` above it (inside a `Modal`, the modal's own).
 */
export function ZoomableImage({ uri, accessibilityLabel }: ZoomableImageProps) {
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // A new photo (Retake) starts back at fit.
  useEffect(() => {
    scale.value = 1;
    x.value = 0;
    y.value = 0;
  }, [scale, uri, x, y]);

  const onLayout = (event: LayoutChangeEvent) => {
    width.value = event.nativeEvent.layout.width;
    height.value = event.nativeEvent.layout.height;
  };

  /** Keeps the zoomed photo covering the block: no empty space dragged into view. */
  const settle = (nextScale: number) => {
    "worklet";
    const maxX = (width.value * (nextScale - 1)) / 2;
    const maxY = (height.value * (nextScale - 1)) / 2;
    x.value = withTiming(clamp(x.value, -maxX, maxX), { duration: 150 });
    y.value = withTiming(clamp(y.value, -maxY, maxY), { duration: 150 });
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = clamp(startScale.value * event.scale, 1, MAX_SCALE);
    })
    .onEnd(() => {
      settle(scale.value);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((event) => {
      // At fit there is nothing to move.
      if (scale.value <= 1) return;
      x.value = startX.value + event.translationX;
      y.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      settle(scale.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : DOUBLE_TAP_SCALE;
      scale.value = withTiming(next, { duration: 200 });
      if (next === 1) {
        x.value = withTiming(0, { duration: 200 });
        y.value = withTiming(0, { duration: 200 });
      }
    });

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <View className="flex-1 overflow-hidden" collapsable={false} onLayout={onLayout}>
        <Animated.View style={[{ flex: 1 }, zoomStyle]}>
          <Image
            accessibilityLabel={accessibilityLabel}
            contentFit="contain"
            source={{ uri }}
            style={{ flex: 1 }}
            transition={150}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
