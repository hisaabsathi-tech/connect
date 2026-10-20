import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

import { colors } from "@/config/colors";

export interface LoaderProps {
  className?: string;
  fullHeight?: boolean;
  fullPage?: boolean;
  size?: "sm" | "md" | "lg";
  /** No background of its own, for a loader inside a card, sheet or list block. */
  transparent?: boolean;
}

const sizes: Record<NonNullable<LoaderProps["size"]>, number> = {
  lg: 48,
  md: 32,
  sm: 24,
};

export function Loader({
  className,
  fullHeight = true,
  fullPage = false,
  size = "md",
  transparent = false,
}: LoaderProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
        toValue: 1,
        useNativeDriver: false,
      }),
    );

    animation.start();
    return () => animation.stop();
  }, [progress]);

  const dimension = sizes[size];
  const containerClasses = [
    "items-center justify-center",
    transparent ? "" : "bg-background",
    fullPage ? "absolute inset-0 z-50 flex-1" : "w-full",
    !fullPage && fullHeight ? "min-h-[80vh]" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" className={containerClasses}>
      {/* NativeWind does not style RN's Animated.View, so the colour must be inline. */}
      <Animated.View
        style={{
          backgroundColor: colors.primary,
          borderRadius: progress.interpolate({
            inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
            outputRange: [
              dimension / 2,
              dimension * 0.35,
              dimension * 0.15,
              2,
              dimension * 0.25,
              dimension / 2,
            ],
          }),
          height: dimension,
          transform: [
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                outputRange: [1, 0.9, 1.1, 0.85, 1.05, 1],
              }),
            },
          ],
          width: dimension,
        }}
      />
    </View>
  );
}
