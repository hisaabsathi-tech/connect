import { View } from "react-native";

import { Avatar } from "@/components/modules/avatar";
import { Text } from "@/components/modules/typography";
import type { Profile } from "@/lib/api/profile";

/** Photo (or generated avatar), name and role at the top of the profile. */
export function ProfileCard({ profile }: { profile: Profile | null }) {
  return (
    <View className="mt-4 flex-row items-center gap-3 bg-[#F0F2FF] p-3">
      <Avatar image={profile?.image} name={profile?.name} seed={profile?.id} size={64} />
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
