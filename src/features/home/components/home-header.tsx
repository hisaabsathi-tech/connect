import { Image } from "expo-image";
import { useMemo } from "react";
import { View } from "react-native";

import { Text } from "@/components/modules/typography";
import type { HomeIdentity } from "@/lib/api/home";

import { greetingFor } from "../lib/greeting";

/** Avatar with a first-name greeting for the time of day. */
export function HomeHeader({ identity }: { identity: HomeIdentity | null }) {
  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);
  return (
    <View className="mb-5 flex-row items-center gap-3">
      <View className="h-16 w-16 overflow-hidden rounded-full bg-accent">
        {identity?.image ? (
          <Image
            contentFit="cover"
            source={{ uri: identity.image }}
            style={{ height: "100%", width: "100%" }}
          />
        ) : null}
      </View>
      <View>
        <Text className="text-2xl font-semibold text-foreground">
          Hi {identity?.name?.split(" ")[0] ?? "there"},
        </Text>
        <Text className="text-xl text-muted-foreground">{greeting}</Text>
      </View>
    </View>
  );
}
