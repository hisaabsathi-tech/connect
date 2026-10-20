import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { haptic } from "@/lib/haptics";

const ILLUSTRATION = require("@/assets/mobile/parcel.webp");
const ILLUSTRATION_SIZE = 96;

/**
 * Connector v1's Manage Orders home card (in its peach), for delivery boys: one card now, as the
 * Orders tab holds both their orders and DRS. Opens that tab.
 */
export function OrdersCard() {
  return (
    <Pressable
      accessibilityHint="Opens the Orders tab"
      accessibilityRole="button"
      className="mt-4 flex-row items-center gap-3 bg-[#FDDED1] py-3 pr-3 pl-5 active:opacity-80"
      onPress={() => router.navigate("/orders")}
      onPressIn={() => haptic("light")}
    >
      <View className="flex-1">
        <Text className="text-lg font-semibold leading-6 text-[#C0562A]">Manage Orders & DRS</Text>
        <Text className="mt-1 text-sm leading-5 text-[#8F5A45]">
          Manage all your orders and DRS for today at one place
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
