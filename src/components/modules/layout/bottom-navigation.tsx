import { Calendar01Icon, Package04Icon, User02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { useViewer } from "@/lib/auth/viewer";
import { type HapticKind, haptic } from "@/lib/haptics";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

type ActiveIconName = "attendance" | "orders" | "profile";

// These used to load from bundled SVG asset URIs. Android debug can resolve those URIs, while
// release APK asset packaging can leave SvgUri with nothing to read. Keeping the same artwork as
// native SVG nodes puts it in the JS bundle and works identically in debug and production.
function ActiveIcon({ name }: { name: ActiveIconName }) {
  if (name === "attendance")
    return (
      <Svg height={28} viewBox="0 0 24 24" width={28}>
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
      </Svg>
    );
  if (name === "orders")
    return (
      <Svg height={28} viewBox="0 0 24 24" width={28}>
        <Path
          d="M2.49219 13.5V7.5H21.4922V13.5C21.4922 17.2712 21.4922 19.1569 20.3206 20.3284C19.149 21.5 17.2634 21.5 13.4922 21.5H10.4922C6.72095 21.5 4.83533 21.5 3.66376 20.3284C2.49219 19.1569 2.49219 17.2712 2.49219 13.5Z"
          fill="#CCD3FF"
          stroke="#465FFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
        <Path
          d="M3.86128 5.31461L2.49219 7.5H21.4922L20.24 5.41303C19.3863 3.99021 18.9595 3.2788 18.2717 2.8894C17.584 2.5 16.7543 2.5 15.095 2.5H8.9459C7.32217 2.5 6.5103 2.5 5.83232 2.8753C5.15433 3.2506 4.72332 3.93861 3.86128 5.31461Z"
          fill="#CCD3FF"
          stroke="#465FFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
        <Path
          d="M11.9922 7.5V2.5"
          stroke="#465FFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
        <Path
          d="M5.99219 18H10.9922M5.99219 15H8.99219"
          stroke="#465FFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </Svg>
    );
  return (
    <Svg height={28} viewBox="0 0 24 24" width={28}>
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
    </Svg>
  );
}

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
          route.name === "attendance" || route.name === "orders" || route.name === "profile"
            ? route.name
            : null;
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
                  <ActiveIcon name={activeIcon} />
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
