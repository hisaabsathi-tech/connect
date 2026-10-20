import { ArrowLeftRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { HapticButton } from "@/components/modules/button";
import { OrganizationOption } from "@/components/modules/organization";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { type AuthOrganization, authApi } from "@/lib/api/auth";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";

/**
 * "Switch" beside the organisation in the profile, shown only when the user belongs to more than
 * one. It opens a sheet listing them with their logos; switching reloads the app's tabs for the
 * chosen organisation (back on Home).
 */
export function OrganizationSwitch({ activeId }: { activeId: string | null | undefined }) {
  const { switchOrganization, token } = useAuthSession();
  const toast = useToast();
  const { height } = useWindowDimensions();
  const [organizations, setOrganizations] = useState<AuthOrganization[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    authApi
      .listOrganizations(token)
      .then((list) => {
        if (active) setOrganizations(list);
      })
      // Without the list there is nothing to switch to; the button stays hidden.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token]);

  if (organizations.length < 2) return null;

  const confirm = async () => {
    const target = organizations.find((organization) => organization.id === picked);
    if (!target || target.id === activeId) {
      setOpen(false);
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
