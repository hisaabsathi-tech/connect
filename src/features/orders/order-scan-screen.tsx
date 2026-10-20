import { Cancel01Icon, FlashIcon, FlashOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { TabScreen } from "@/components/modules/layout";
import { Skeleton } from "@/components/modules/skeleton";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { haptic } from "@/lib/haptics";

import { barcodeMatches, openedOrder } from "./lib/active-order";

// The 1D codes parcel labels carry.
const BARCODE_TYPES = ["code128", "code39", "code93", "itf14", "ean13", "ean8", "codabar"] as const;
// The camera window: wide and short, the shape of a label's barcode.
const WINDOW_HEIGHT = 150;
// A code read again within this long is the same sighting, not a new attempt.
const SAME_CODE_MS = 1500;
const MISMATCH = "That barcode does not match this order.";
const LASER = "#EF4444";

/** The scanner's red line across the middle of the window, blinking. */
function ScanLine() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.15, { duration: 550, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const blink = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          backgroundColor: LASER,
          height: 2,
          left: 12,
          position: "absolute",
          right: 12,
          top: WINDOW_HEIGHT / 2 - 1,
        },
        blink,
      ]}
    />
  );
}

function RoundButton({
  active = false,
  icon,
  label,
  onPress,
}: {
  active?: boolean;
  icon: typeof Cancel01Icon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`h-11 w-11 items-center justify-center rounded-full ${active ? "bg-primary" : "bg-[#EEEFF2]"} active:opacity-80`}
      onPress={onPress}
      onPressIn={() => haptic("light")}
    >
      <HugeiconsIcon
        color={active ? colors.primaryForeground : colors.foreground}
        icon={icon}
        size={20}
        strokeWidth={1.8}
      />
    </Pressable>
  );
}

/**
 * Scan the parcel label of the order tapped in the list: the camera reads in the bordered
 * window (the red line marks where to aim), the flash lights a dim label, and a barcode that
 * matches the order's AWB (or reference) opens its update; any other code says it doesn't match.
 */
export function OrderScanScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const order = openedOrder(orderId);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [focused, setFocused] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const matched = useRef(false);
  const lastCode = useRef({ at: 0, value: "" });

  // The camera (and flash) runs only while this screen is in front.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      matched.current = false;
      return () => {
        setFocused(false);
        setTorch(false);
      };
    }, []),
  );

  // Asks once on arrival; a refusal shows how to allow it instead.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const onScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (!order || matched.current) return;
      const value = data.trim();
      const now = Date.now();
      if (!value || (value === lastCode.current.value && now - lastCode.current.at < SAME_CODE_MS))
        return;
      lastCode.current = { at: now, value };
      if (barcodeMatches(value, order)) {
        matched.current = true;
        haptic("success");
        setTorch(false);
        router.replace({ params: { orderId: order.orderId }, pathname: "/orders/update" });
        return;
      }
      haptic("error");
      setError(MISMATCH);
    },
    [order],
  );

  const granted = Boolean(permission?.granted);
  return (
    <TabScreen>
      <View className="flex-1 bg-card px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <RoundButton icon={Cancel01Icon} label="Close scanner" onPress={() => router.back()} />
          {granted && order ? (
            <RoundButton
              active={torch}
              icon={torch ? FlashOffIcon : FlashIcon}
              label={torch ? "Turn the flash off" : "Turn the flash on"}
              onPress={() => setTorch((on) => !on)}
            />
          ) : null}
        </View>

        <View
          className="mt-8 overflow-hidden border-[3px] border-primary bg-black"
          style={{ height: WINDOW_HEIGHT + 6 }}
        >
          {!order ? null : granted ? (
            <>
              <CameraView
                active={focused}
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                enableTorch={torch && focused}
                facing="back"
                onBarcodeScanned={focused ? onScanned : undefined}
                style={{ flex: 1 }}
              />
              <ScanLine />
            </>
          ) : permission ? null : (
            <Skeleton height={WINDOW_HEIGHT} />
          )}
        </View>

        {!order ? (
          <Text className="mt-4 text-center text-sm text-muted-foreground">
            This order isn't open any more. Go back and tap it in the list again.
          </Text>
        ) : permission && !granted ? (
          <View className="mt-4 items-center gap-3">
            <Text className="text-center text-sm text-muted-foreground">
              Allow the camera to scan the parcel label.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="h-10 justify-center border border-primary px-4 active:bg-accent"
              onPress={() =>
                permission.canAskAgain
                  ? void requestPermission()
                  : void Linking.openSettings().catch(() => undefined)
              }
            >
              <Text className="text-sm font-medium text-primary">
                {permission.canAskAgain ? "Allow camera" : "Open settings"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text className="mt-4 text-center text-base text-muted-foreground">
              Scan the Barcode on Parcel Label
            </Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              AWB {order.awbNo}
            </Text>
            {error ? (
              <Text className="mt-3 text-center text-sm text-destructive">{error}</Text>
            ) : null}
          </>
        )}
      </View>
    </TabScreen>
  );
}
