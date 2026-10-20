import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { Avatar } from "@/components/modules/avatar";
import { Text } from "@/components/modules/typography";
import type { HomeIdentity } from "@/lib/api/home";
import { haptic } from "@/lib/haptics";

const quotes = [
  "Let’s make today a good one.",
  "Ready when you are.",
  "One step at a time.",
  "Here’s to a productive day.",
  "Your day is waiting for you.",
  "Start your day with a smile.",
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
      className="mb-3 flex-row items-center gap-3"
      onPress={() => {
        haptic("light");
        router.push("/profile");
      }}
    >
      <Avatar image={identity?.image} name={identity?.name} round seed={identity?.id} size={52} />
      <View className="flex-1">
        <Text className="font-semibold text-lg text-foreground">Hi, {name}</Text>
        <Text className="mt-0.5 font-semibold text-muted-foreground text-sm">
          {quoteForToday()}
        </Text>
      </View>
    </Pressable>
  );
}
