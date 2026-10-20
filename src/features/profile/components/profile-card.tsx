import { Image } from "expo-image";
import { View } from "react-native";

import { Text } from "@/components/modules/typography";
import type { Profile } from "@/lib/api/profile";

import { initials } from "../lib/initials";

/** Photo (or initials), name and role at the top of the profile. */
export function ProfileCard({ profile }: { profile: Profile | null }) {
  return (
    <View className="mt-4 flex-row items-center gap-3 bg-[#F0F2FF] p-3">
      <View className="h-16 w-16 items-center justify-center overflow-hidden bg-[#CDD4FF]">
        {profile?.image ? (
          <Image
            contentFit="cover"
            source={{ uri: profile.image }}
            style={{ height: "100%", width: "100%" }}
          />
        ) : (
          <Text className="text-xl font-semibold text-primary">
            {initials(profile?.name ?? "")}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
          {profile?.name || "—"}
        </Text>
        <Text className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {profile?.role || "Employee"}
        </Text>
      </View>
    </View>
  );
}
