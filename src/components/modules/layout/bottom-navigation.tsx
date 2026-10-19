import { Calendar01Icon, User02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { type HapticKind, haptic } from "@/lib/haptics";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const items = {
  index: { icon: null, label: "Home" },
  attendance: { icon: Calendar01Icon, label: "Attendance" },
  profile: { icon: User02Icon, label: "Profile" },
} as const;

const pageHaptics: Record<keyof typeof items, HapticKind> = {
  attendance: "medium",
  index: "selection",
  profile: "light",
};

/** The current role baseline: every signed-in user gets these three destinations. */
export function BottomNavigation({ insets, navigation, state }: BottomTabBarProps) {
  return (
    <View className="flex-row bg-[#F0F2FF] px-5 pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
      {state.routes.map((route, index) => {
        const item = items[route.name as keyof typeof items];
        if (!item) return null;
        const active = state.index === index;
        const color = active ? colors.primary : colors.foreground;
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
              {item.icon ? (
                <HugeiconsIcon color={color} icon={item.icon} size={26} />
              ) : (
                <Image
                  contentFit="contain"
                  source={require("@/assets/mobile/home-fav.webp")}
                  style={{ height: 24, width: 24 }}
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
