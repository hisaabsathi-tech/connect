import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "hugeicons-react-native";
import { type PropsWithChildren, useEffect } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast, { type ToastConfig } from "react-native-toast-message";
import { scheduleOnRN } from "react-native-worklets";

type ToastKind = "error" | "info" | "success";

function ToastIcon({ type }: { type: ToastKind }) {
  const Icon =
    type === "error"
      ? AlertCircleIcon
      : type === "success"
        ? CheckmarkCircle02Icon
        : InformationCircleIcon;
  const color = type === "error" ? "#DC2626" : type === "success" ? "#16A34A" : "#465FFF";
  return <Icon color={color} size={20} strokeWidth={2} />;
}

function AppToast({
  type,
  text1,
  text2,
  isVisible,
  onPress,
}: {
  type: ToastKind;
  text1?: string;
  text2?: string;
  isVisible: boolean;
  onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const hide = () => Toast.hide();

  // The library reuses this view for the next toast, so bring it back on show.
  useEffect(() => {
    if (isVisible) translateX.value = 0;
  }, [isVisible, translateX]);

  // Horizontal swipe to dismiss; the library itself only handles swipe up.
  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const dismiss = Math.abs(event.translationX) > width * 0.3 || Math.abs(event.velocityX) > 800;
      if (!dismiss) {
        translateX.value = withSpring(0, { damping: 20, stiffness: 240 });
        return;
      }
      const direction = (event.translationX || event.velocityX) < 0 ? -1 : 1;
      translateX.value = withTiming(direction * width, { duration: 180 }, (finished) => {
        if (finished) scheduleOnRN(hide);
      });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translateX.value), [0, width * 0.6], [1, 0], "clamp"),
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View style={[{ width: "100%" }, animatedStyle]}>
        <View className="w-full items-center px-6">
          <Pressable
            accessibilityRole="alert"
            className="w-full max-w-sm flex-row items-start gap-3 border border-border bg-card px-4 py-3"
            onPress={onPress}
            style={{
              elevation: 8,
              shadowColor: "#101828",
              shadowOffset: { height: 6, width: 0 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
            }}
          >
            {/* Same height as the title's line box, nudged down to sit on the title's baseline. */}
            <View className="mt-[3px] h-5 justify-center">
              <ToastIcon type={type} />
            </View>
            <View className="flex-1">
              {text1 ? (
                <Text className="font-heading text-sm leading-5 text-foreground" numberOfLines={2}>
                  {text1}
                </Text>
              ) : null}
              {text2 ? (
                <Text
                  className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground"
                  numberOfLines={3}
                >
                  {text2}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const toastConfig: ToastConfig = {
  appError: ({ isVisible, onPress, text1, text2 }) => (
    <AppToast isVisible={isVisible} onPress={onPress} text1={text1} text2={text2} type="error" />
  ),
  appInfo: ({ isVisible, onPress, text1, text2 }) => (
    <AppToast isVisible={isVisible} onPress={onPress} text1={text1} text2={text2} type="info" />
  ),
  appSuccess: ({ isVisible, onPress, text1, text2 }) => (
    <AppToast isVisible={isVisible} onPress={onPress} text1={text1} text2={text2} type="success" />
  ),
};

export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <>
      {children}
      <Toast config={toastConfig} topOffset={insets.top + 12} />
    </>
  );
}

export function useToast() {
  return {
    error: (title: string, description?: string) =>
      Toast.show({ text1: title, text2: description, type: "appError" }),
    show: ({
      title,
      description,
      type = "info",
    }: {
      description?: string;
      title: string;
      type?: ToastKind;
    }) =>
      Toast.show({
        text1: title,
        text2: description,
        type: type === "success" ? "appSuccess" : type === "error" ? "appError" : "appInfo",
      }),
    success: (title: string, description?: string) =>
      Toast.show({ text1: title, text2: description, type: "appSuccess" }),
  };
}
