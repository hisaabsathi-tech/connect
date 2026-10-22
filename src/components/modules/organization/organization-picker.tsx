import { Building03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { haptic } from "@/lib/haptics";

import type { OrganizationChoice } from "./organizations";

// The list stops at this share of the screen and scrolls past it.
const LIST_SHARE = 0.55;

function Option({
  onPress,
  selected,
  title,
}: {
  onPress: () => void;
  selected: boolean;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 border-border border-b px-1 py-3.5 ${selected ? "bg-accent active:bg-accent" : "active:bg-[#F7F8FF]"}`}
      onPress={onPress}
    >
      <View className="h-9 w-9 items-center justify-center bg-accent">
        <HugeiconsIcon color={colors.primary} icon={Building03Icon} size={18} strokeWidth={1.8} />
      </View>
      <Text
        className={`flex-1 text-base ${selected ? "font-semibold text-primary" : "font-medium text-foreground"}`}
        numberOfLines={2}
      >
        {title}
      </Text>
      <View className="w-6 items-center pr-1">
        {selected ? <HugeiconsIcon color={colors.primary} icon={Tick02Icon} size={18} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * The organization selector at the end of a search bar: a building button that opens the list
 * of organizations. Highlighted while one is chosen. With `allowAll`, an "All organizations" row
 * clears the choice. Nothing shows for fewer than two organizations, so a list holding a single
 * organization's data never offers it.
 */
export function OrganizationPicker({
  allowAll = false,
  description,
  onChange,
  organizations,
  value,
}: {
  allowAll?: boolean;
  /** The line under the sheet's title, e.g. "Show the pickups of one organization". */
  description: string;
  onChange: (organizationId: string | null) => void;
  organizations: OrganizationChoice[];
  value: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  if (organizations.length < 2) return null;
  const selected = organizations.find((organization) => organization.id === value) ?? null;
  // Highlighted while it narrows things down; a required choice always has one.
  const narrowing = allowAll && selected !== null;

  const choose = (organizationId: string | null) => {
    haptic("selection");
    setOpen(false);
    onChange(organizationId);
  };

  return (
    <>
      <Pressable
        accessibilityLabel={
          selected ? `Organization: ${selected.name}. Change organization` : "Choose organization"
        }
        accessibilityRole="button"
        className={`h-full w-12 items-center justify-center border-border border-l ${narrowing ? "bg-accent" : ""}`}
        onPress={() => setOpen(true)}
        onPressIn={() => haptic("light")}
      >
        <HugeiconsIcon
          color={narrowing || !allowAll ? colors.primary : colors.foreground}
          icon={Building03Icon}
          size={20}
          strokeWidth={1.8}
        />
      </Pressable>
      <BottomSheet dragHandleOnly onClose={() => setOpen(false)} visible={open}>
        <Text className="mt-5 text-xl font-semibold text-foreground">Select Organization</Text>
        <Text className="mt-1 text-sm text-muted-foreground">{description}</Text>
        <ScrollView className="mt-4" style={{ maxHeight: height * LIST_SHARE }}>
          {allowAll ? (
            <Option onPress={() => choose(null)} selected={!selected} title="All organizations" />
          ) : null}
          {organizations.map((organization) => (
            <Option
              key={organization.id}
              onPress={() => choose(organization.id)}
              selected={organization.id === selected?.id}
              title={organization.name}
            />
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}
