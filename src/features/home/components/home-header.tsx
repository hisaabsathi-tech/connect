import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import type { HomeIdentity } from "@/lib/api/home";
import { haptic } from "@/lib/haptics";

const quotes = [
  "Let’s make today a good one.",
  "Ready when you are.",
  "One step at a time.",
  "Here’s to a productive day.",
  "You’ve got this.",
];

function quoteForToday() {
  const today = new Date();
  const dayNumber = Math.floor(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000,
  );
  return quotes[dayNumber % quotes.length];
}

/** Profile entry point with a daily work-focused message. */
export function HomeHeader({ identity }: { identity: HomeIdentity | null }) {
  const router = useRouter();
  const name = identity?.name?.trim().split(/\s+/)[0] || "there";
  return (
    <Pressable
      accessibilityHint="Opens your profile"
      accessibilityRole="button"
      className="mb-5 flex-row items-center gap-3"
      onPress={() => {
        haptic("light");
        router.push("/profile");
      }}
    >
      <View className="h-14 w-14 overflow-hidden rounded-full bg-accent">
        {identity?.image ? (
          <Image
            contentFit="cover"
            source={{ uri: identity.image }}
            style={{ height: "100%", width: "100%" }}
          />
        ) : null}
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-lg text-foreground">Hi, {name}</Text>
        <Text className="mt-0.5 text-muted-foreground text-sm">{quoteForToday()}</Text>
      </View>
    </Pressable>
  );
}
