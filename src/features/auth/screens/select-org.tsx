import { View } from "react-native";

import { ActionButton } from "@/components/modules/button";
import { OrganizationOption } from "@/components/modules/organization";
import { haptic } from "@/lib/haptics";

import { AuthCard } from "../components/auth-card";
import type { AuthStepProps } from "../lib/types";

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
