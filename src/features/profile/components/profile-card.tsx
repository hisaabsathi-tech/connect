import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable, View } from "react-native";

import { Avatar } from "@/components/modules/avatar";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { Profile } from "@/lib/api/profile";

/** Photo (or generated avatar) with its edit button, name and role at the top of the profile. */
export function ProfileCard({
  onEditPhoto,
  profile,
}: {
  onEditPhoto: () => void;
  profile: Profile | null;
}) {
  return (
    <View className="mt-4 flex-row items-center gap-3 bg-[#F0F2FF] p-3">
      <View>
        <Avatar image={profile?.image} name={profile?.name} seed={profile?.id} size={64} />
        <Pressable
          accessibilityLabel="Change profile photo"
          accessibilityRole="button"
          className="absolute -right-1.5 -bottom-1.5 h-6 w-6 items-center justify-center border border-primary bg-white"
          hitSlop={10}
          onPress={onEditPhoto}
        >
          <HugeiconsIcon color={colors.primary} icon={PencilEdit02Icon} size={14} strokeWidth={2} />
        </Pressable>
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
          {profile?.name || "—"}
        </Text>
        <Text className="mt-1 text-xs font-medium uppercase tracking-[0.3px] text-muted-foreground">
          {profile?.role || "Employee"}
        </Text>
      </View>
    </View>
  );
}
