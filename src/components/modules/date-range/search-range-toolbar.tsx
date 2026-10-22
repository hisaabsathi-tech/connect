import { Calendar03Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { type ReactNode, useState } from "react";
import { Pressable, TextInput, type TextInputProps, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { haptic } from "@/lib/haptics";

import { DateRangeSheet } from "./date-range-sheet";
import { type DateRange, rangeLabel } from "./range-label";

/** An applied filter under the bar; tapping it or its cross clears it. */
function Chip({
  clearLabel,
  label,
  onClear,
}: {
  clearLabel: string;
  label: string;
  onClear: () => void;
}) {
  const clear = () => {
    haptic("light");
    onClear();
  };
  return (
    <View className="h-9 max-w-full flex-row items-center border border-primary bg-accent">
      <Pressable
        accessibilityLabel={clearLabel}
        accessibilityRole="button"
        className="h-full shrink justify-center"
        onPress={clear}
      >
        <Text className="px-3 text-sm text-primary" numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={clearLabel}
        accessibilityRole="button"
        className="h-full w-9 items-center justify-center border-primary border-l"
        onPress={clear}
      >
        <HugeiconsIcon color={colors.primary} icon={Cancel01Icon} size={14} />
      </Pressable>
    </View>
  );
}

/**
 * The list pages' search bar with the date range calendar at its end. An applied range shows as
 * a chip under the bar, with a cross that clears it. The range sheet is rendered here.
 */
export function SearchRangeToolbar({
  accessory,
  allowFuture = false,
  autoCapitalize = "words",
  filterChip,
  onQueryChange,
  onSelectedDateClear,
  onRangeChange,
  query,
  range,
  searchLabel,
  selectedDate = null,
  today,
}: {
  /** Another filter button in the bar, before the calendar (e.g. an organization picker). */
  accessory?: ReactNode;
  /** That filter's applied value, as a chip with a cross beside the date chip. */
  filterChip?: { label: string; onClear: () => void } | null;
  /** The calendar also offers upcoming days (and a Tomorrow preset). */
  allowFuture?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  onQueryChange: (query: string) => void;
  /** Clears a single day chosen in the shared Home calendar. */
  onSelectedDateClear?: () => void;
  onRangeChange: (range: DateRange | null) => void;
  query: string;
  range: DateRange | null;
  /** Read out for the search field, e.g. "Search employees". */
  searchLabel: string;
  /** A non-today day chosen on Home, shown unless a local range takes precedence. */
  selectedDate?: string | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View className="h-12 flex-row items-center border border-border bg-card">
        <View className="pl-3">
          <HugeiconsIcon color={colors.mutedForeground} icon={Search01Icon} size={20} />
        </View>
        <TextInput
          accessibilityLabel={searchLabel}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          className="h-full flex-1 px-3 font-sans text-base text-foreground"
          onChangeText={onQueryChange}
          placeholder="Search"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          value={query}
        />
        {query ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            className="h-full w-10 items-center justify-center"
            onPress={() => onQueryChange("")}
          >
            <HugeiconsIcon color={colors.mutedForeground} icon={Cancel01Icon} size={16} />
          </Pressable>
        ) : null}
        {accessory}
        <Pressable
          accessibilityLabel="Select date range"
          accessibilityRole="button"
          className={`h-full w-12 items-center justify-center border-border border-l ${range ? "bg-accent" : ""}`}
          onPress={() => setOpen(true)}
          onPressIn={() => haptic("light")}
        >
          <HugeiconsIcon
            color={range ? colors.primary : colors.foreground}
            icon={Calendar03Icon}
            size={20}
            strokeWidth={1.8}
          />
        </Pressable>
      </View>
      {range || selectedDate || filterChip ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {range || selectedDate ? (
            <Chip
              clearLabel={range ? "Clear date range" : "Clear selected date"}
              label={
                range ? rangeLabel(range) : rangeLabel({ from: selectedDate!, to: selectedDate! })
              }
              onClear={() => {
                if (range) onRangeChange(null);
                else onSelectedDateClear?.();
              }}
            />
          ) : null}
          {filterChip ? (
            <Chip
              clearLabel={`Clear ${filterChip.label}`}
              label={filterChip.label}
              onClear={filterChip.onClear}
            />
          ) : null}
        </View>
      ) : null}
      <DateRangeSheet
        allowFuture={allowFuture}
        onApply={(next) => {
          setOpen(false);
          onRangeChange(next);
        }}
        onClose={() => setOpen(false)}
        range={range}
        today={today}
        visible={open}
      />
    </>
  );
}
