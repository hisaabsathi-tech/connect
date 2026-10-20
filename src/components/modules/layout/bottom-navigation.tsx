import { Calendar01Icon, User02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { type HapticKind, haptic } from "@/lib/haptics";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

type ActiveTabIconName = "attendance" | "profile";

/**
 * Inline SVG avoids the asynchronous URI load that could briefly delay an active tab icon.
 * The 28px canvas compensates for the artwork's internal whitespace; its visible glyph aligns
 * with the 26px Hugeicons and home image.
 */
function ActiveTabIcon({ name }: { name: ActiveTabIconName }) {
  return (
    <Svg fill="none" height={28} viewBox="0 0 24 24" width={28}>
      {name === "attendance" ? (
        <>
          <Path
            d="M16 2V6M8 2V6"
            stroke="#465FFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
          <Path
            d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z"
            fill="#CCD3FF"
            stroke="#465FFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
          <Path
            d="M3 10H21"
            stroke="#465FFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
          <Path
            d="M10 18.5002L9.99999 13.8474C9.99999 13.6557 9.86325 13.5002 9.69458 13.5002H9M14 18.4983L15.4855 13.8923C15.4951 13.8626 15.5 13.8315 15.5 13.8002C15.5 13.6346 15.3657 13.5002 15.2 13.5002L13 13.5"
            stroke="#465FFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </>
      ) : (
        <>
          <Path
            d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
            fill="#CCD3FF"
            stroke="#465FFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
          <Path
            d="M12 14C7 14 4 16.5 4 19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19C20 16.5 17 14 12 14Z"
            fill="#CCD3FF"
            stroke="#465FFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </>
      )}
    </Svg>
  );
}

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
        const activeIcon =
          route.name === "attendance" || route.name === "profile" ? route.name : null;
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
                <ActiveTabIcon name={activeIcon} />
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
