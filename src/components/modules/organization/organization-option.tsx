import { Building03Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { AuthOrganization } from "@/lib/api/auth";

/** One organisation to pick: its logo (or a building icon), name and a tick when selected. */
export function OrganizationOption({
  organization,
  selected,
  onPress,
}: {
  organization: AuthOrganization;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className={`flex-row items-center gap-3 border px-3 py-3 ${selected ? "border-primary bg-accent active:bg-accent" : "border-border bg-card active:bg-muted"}`}
      onPress={onPress}
    >
      {organization.logo ? (
        <Image
          contentFit="contain"
          source={{ uri: organization.logo }}
          style={{ height: 40, width: 40 }}
        />
      ) : (
        <View className="h-10 w-10 items-center justify-center bg-accent">
          <HugeiconsIcon color={colors.primary} icon={Building03Icon} size={20} strokeWidth={1.8} />
        </View>
      )}
      <Text className="flex-1 text-base font-medium text-foreground" numberOfLines={2}>
        {organization.name}
      </Text>
      {selected ? (
        <HugeiconsIcon color={colors.primary} icon={CheckmarkCircle02Icon} size={22} />
      ) : null}
    </Pressable>
  );
}
