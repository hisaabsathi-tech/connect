import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { haptic } from "@/lib/haptics";
import { formatText } from "@/lib/text";

// The list stops at this share of the screen and scrolls past it.
const LIST_SHARE = 0.55;

export interface SelectFieldProps {
  label: string;
  /** The chosen option, or "" for none. */
  value: string;
  options: readonly string[];
  /** Called with the option picked, or "" when None is. */
  onChange: (value: string) => void;
  placeholder: string;
  /** Greyed out and closed, e.g. until the field it depends on is chosen. */
  disabled?: boolean;
  /** Shown in the list when there is nothing to choose. */
  emptyText?: string;
}

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
 * A labelled optional choice from a list, laid out like `FormField`: the box shows the chosen
 * option (or the placeholder) and opens the list in a bottom sheet, with None at its top to clear
 * the choice. Options show as the web shows them ("NON_DOX" as "NON DOX") but are picked as
 * they are.
 */
export function SelectField({
  disabled = false,
  emptyText = "Nothing to choose from yet",
  label,
  onChange,
  options,
  placeholder,
  value,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();

  const choose = (option: string) => {
    haptic("selection");
    setOpen(false);
    onChange(option);
  };

  return (
    <View>
      <Text className="mb-2 text-base text-foreground" numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        accessibilityLabel={`${label}, ${formatText(value) || "none chosen"}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className={`h-12 flex-row items-center gap-2 border border-border px-3.5 active:bg-[#F7F8FF] ${disabled ? "bg-muted" : "bg-card"}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        onPressIn={() => haptic("light")}
      >
        <Text
          className={`flex-1 text-base ${value && !disabled ? "text-foreground" : "text-[#9CA3AF]"}`}
          numberOfLines={1}
        >
          {formatText(value) || placeholder}
        </Text>
        <HugeiconsIcon
          color={disabled ? "#9CA3AF" : colors.mutedForeground}
          icon={ArrowDown01Icon}
          size={18}
        />
      </Pressable>
      <BottomSheet dragHandleOnly onClose={() => setOpen(false)} visible={open}>
        <Text className="mt-5 text-xl font-semibold text-foreground">{label}</Text>
        <ScrollView className="mt-4" style={{ maxHeight: height * LIST_SHARE }}>
          {options.length ? (
            <>
              <Option onPress={() => choose("")} selected={!value} title="None" />
              {options.map((option) => (
                <Option
                  key={option}
                  onPress={() => choose(option)}
                  selected={option === value}
                  title={formatText(option)}
                />
              ))}
            </>
          ) : (
            <Text className="py-6 text-center text-sm text-muted-foreground">{emptyText}</Text>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}
