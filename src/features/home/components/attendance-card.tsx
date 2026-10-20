import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { haptic } from "@/lib/haptics";

const ILLUSTRATION = require("@/assets/mobile/attendance.webp");
const ILLUSTRATION_SIZE = 96;

/**
 * Connector v1's Attendance home card, for users who don't check in themselves (a superadmin
 * while the Superadmin Attendance module is off). Opens the Attendance tab.
 */
export function AttendanceCard() {
  return (
    <Pressable
      accessibilityHint="Opens the Attendance tab"
      accessibilityRole="button"
      className="flex-row items-center gap-3 bg-[#D9E8AC] py-3 pr-3 pl-5 active:opacity-80 mt-4"
      onPress={() => router.navigate("/attendance")}
      onPressIn={() => haptic("light")}
    >
      <View className="flex-1">
        <Text className="text-lg font-semibold leading-6 text-[#2F5A1F]">Attendance</Text>
        <Text className="mt-1 text-sm leading-5 text-[#3E6B32]">
         Manage your employees' attendance and view their check-ins and check-outs.
        </Text>
      </View>
      <Image
        contentFit="contain"
        source={ILLUSTRATION}
        style={{ height: ILLUSTRATION_SIZE, width: ILLUSTRATION_SIZE }}
      />
    </Pressable>
  );
}
