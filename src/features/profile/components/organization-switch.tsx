import { ArrowLeftRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { HapticButton } from "@/components/modules/button";
import { useNetwork } from "@/components/modules/network";
import { OrganizationOption } from "@/components/modules/organization";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import type { AuthOrganization } from "@/lib/api/auth";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { outboxNow } from "@/lib/offline/outbox";

/**
 * "Switch" beside the company in the profile, shown only when there is more than one to choose
 * (synced copies of one owner's companies count as one). It opens a sheet listing them with their
 * logos; switching reloads the app's tabs for the chosen company (back on Home).
 */
export function OrganizationSwitch({
  activeId,
  organizations,
}: {
  activeId: string | null | undefined;
  /** From `useMemberships`. */
  organizations: AuthOrganization[];
}) {
  const { switchOrganization } = useAuthSession();
  const { requireOnline } = useNetwork();
  const toast = useToast();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  if (organizations.length < 2) return null;

  const confirm = async () => {
    const target = organizations.find((organization) => organization.id === picked);
    if (!target || target.id === activeId) {
      setOpen(false);
      return;
    }
    if (!requireOnline("Switching organization")) return;
    // Updates saved offline are for this organisation; they go out before leaving it.
    if (outboxNow().items.length) {
      toast.error(
        "Sync your updates first",
        "Some updates saved offline haven't reached the server yet. Switch once they've synced.",
      );
      return;
    }
    setSwitching(true);
    try {
      await switchOrganization(target.id);
      toast.success("Organization switched", `You are now in ${target.name}.`);
    } catch (error) {
      setSwitching(false);
      toast.error("Couldn't switch organization", errorMessage(error, "Please try again."));
    }
  };

  return (
    <>
      <Pressable
        accessibilityLabel="Switch organization"
        accessibilityRole="button"
        // Same look as the Change password button.
        className="flex-row items-center gap-1.5 bg-primary px-3 py-2.5 active:bg-primary-hover"
        onPress={() => {
          setPicked(activeId ?? null);
          setOpen(true);
        }}
        onPressIn={() => haptic("light")}
      >
        <Text className="text-sm font-semibold text-primary-foreground">Switch</Text>
        <HugeiconsIcon color={colors.primaryForeground} icon={ArrowLeftRightIcon} size={18} />
      </Pressable>
      <BottomSheet
        dismissible={!switching}
        dragHandleOnly
        onClose={() => setOpen(false)}
        visible={open}
      >
        <Text className="mt-2 text-xl font-semibold leading-7 text-foreground">
          Switch organization
        </Text>
        <Text className="mt-0.5 text-sm text-muted-foreground">
          Choose the organization to work in.
        </Text>
        <ScrollView
          accessibilityRole="radiogroup"
          className="mt-4"
          contentContainerClassName="gap-2.5"
          style={{ maxHeight: height * 0.5 }}
        >
          {organizations.map((organization) => (
            <OrganizationOption
              key={organization.id}
              onPress={() => {
                haptic("selection");
                setPicked(organization.id);
              }}
              organization={organization}
              selected={organization.id === picked}
            />
          ))}
        </ScrollView>
        <View className="mt-5 flex-row gap-3">
          <HapticButton
            disabled={switching}
            kind="light"
            label="Cancel"
            onPress={() => setOpen(false)}
          />
          <HapticButton
            disabled={switching || !picked || picked === activeId}
            kind="medium"
            label={switching ? "Switching…" : "Switch"}
            onPress={() => void confirm()}
            tone="brand"
          />
        </View>
      </BottomSheet>
    </>
  );
}
