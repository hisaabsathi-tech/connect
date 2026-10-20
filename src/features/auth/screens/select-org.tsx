import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { ActionButton } from "@/components/modules/button";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { AuthOrganization } from "@/lib/api/auth";
import { haptic } from "@/lib/haptics";

import { AuthCard } from "../components/auth-card";
import type { AuthStepProps } from "../lib/types";

function OrganizationOption({
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
      className={`flex-row items-center gap-3 border px-3 py-3 ${selected ? "border-primary bg-accent" : "border-border bg-card active:bg-muted"}`}
      onPress={onPress}
    >
      {organization.logo ? (
        <Image
          contentFit="contain"
          source={{ uri: organization.logo }}
          style={{ height: 40, width: 40 }}
        />
      ) : null}
      <Text className="flex-1 text-base font-medium text-foreground" numberOfLines={2}>
        {organization.name}
      </Text>
      {selected ? (
        <HugeiconsIcon color={colors.primary} icon={CheckmarkCircle02Icon} size={22} />
      ) : null}
    </Pressable>
  );
}

/** Shown after sign-in when the account belongs to more than one organisation. */
export function SelectOrgStep({ flow }: AuthStepProps) {
  return (
    <AuthCard
      title="Select organization"
      description="Your account belongs to more than one organization. Choose the one to open."
    >
      <View accessibilityRole="radiogroup" className="gap-2.5">
        {flow.organizations.map((organization) => (
          <OrganizationOption
            key={organization.id}
            onPress={() => {
              haptic("selection");
              flow.setOrganizationId(organization.id);
            }}
            organization={organization}
            selected={organization.id === flow.organizationId}
          />
        ))}
      </View>
      <ActionButton
        disabled={flow.pending || !flow.organizationId}
        label="Continue"
        loading={flow.pending}
        onPress={flow.selectOrganization}
      />
      <ActionButton
        arrow={false}
        disabled={flow.pending}
        label="Back to sign in"
        onPress={flow.cancelOrganization}
        outline
      />
    </AuthCard>
  );
}
