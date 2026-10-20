import { Calendar01Icon, Package04Icon, User02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Image as NativeImage, Pressable, View } from "react-native";
import { SvgUri } from "react-native-svg";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { useViewer } from "@/lib/auth/viewer";
import { type HapticKind, haptic } from "@/lib/haptics";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const activeIcons = {
  attendance: NativeImage.resolveAssetSource(require("@/assets/mobile/nav/attendance.svg")),
  orders: NativeImage.resolveAssetSource(require("@/assets/mobile/nav/package.svg")),
  profile: NativeImage.resolveAssetSource(require("@/assets/mobile/nav/profile.svg")),
} as const;

const items = {
  index: { icon: null, label: "Home" },
  orders: { icon: Package04Icon, label: "Orders" },
  attendance: { icon: Calendar01Icon, label: "Attendance" },
  profile: { icon: User02Icon, label: "Profile" },
} as const;

const pageHaptics: Record<keyof typeof items, HapticKind> = {
  attendance: "medium",
  index: "selection",
  orders: "medium",
  profile: "light",
};

// Destinations only some roles get; everyone else never sees them in the bar.
const DELIVERY_BOY_ONLY = new Set(["orders"]);

/** Home, Attendance and Profile for every signed-in user; Orders for delivery boys too. */
export function BottomNavigation({ insets, navigation, state }: BottomTabBarProps) {
  const { isDeliveryBoy } = useViewer();
  return (
    <View className="flex-row bg-[#F0F2FF] px-5 pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
      {state.routes.map((route, index) => {
        const item = items[route.name as keyof typeof items];
        if (!item || (DELIVERY_BOY_ONLY.has(route.name) && !isDeliveryBoy)) return null;
        const active = state.index === index;
        const color = active ? colors.primary : colors.foreground;
        const activeIcon =
          route.name in activeIcons ? (route.name as keyof typeof activeIcons) : null;
        const onPress = () => {
          const event = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: "tabPress",
          });
          if (!(active || event.defaultPrevented)) {
            haptic(pageHaptics[route.name as keyof typeof items]);
            navigation.navigate(route.name);
          }
        };
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="flex-1 items-center gap-1"
            key={route.key}
            onPress={onPress}
          >
            <View className="h-7 items-center justify-center">
              {activeIcon && active ? (
                <View style={{ transform: [{ translateY: 1 }] }}>
                  <SvgUri height={28} uri={activeIcons[activeIcon].uri} width={28} />
                </View>
              ) : item.icon ? (
                <HugeiconsIcon color={color} icon={item.icon} size={26} />
              ) : (
                <Image
                  contentFit="contain"
                  source={require("@/assets/mobile/home-fav.webp")}
                  style={{ height: 26, width: 26 }}
                />
              )}
            </View>
            <Text
              className={
                active ? "text-xs font-medium text-primary" : "text-xs font-medium text-foreground"
              }
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
