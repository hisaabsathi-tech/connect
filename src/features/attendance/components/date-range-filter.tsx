import { DateRangePickerDialog, Host } from "@expo/ui/jetpack-compose";
import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { dateOf, formatDayLabel } from "@/lib/date";
import { haptic } from "@/lib/haptics";

import type { DateRange } from "../hooks/use-attendance-range";

/** The picker reports UTC midnights; their `YYYY-MM-DD` is the picked day. */
const isoOf = (date: Date) => date.toISOString().slice(0, 10);

// The app's palette on Material's picker: a white sheet, navy text, brand-blue range ends with
// the days between on the soft accent, instead of Material's tinted surface.
const pickerColors = {
  containerColor: "#FFFFFF",
  currentYearContentColor: colors.primary,
  dayContentColor: colors.foreground,
  dayInSelectionRangeContainerColor: "#E9ECFF",
  dayInSelectionRangeContentColor: colors.foreground,
  disabledDayContentColor: "#C3C7D4",
  dividerColor: "#E5E7EB",
  headlineContentColor: colors.foreground,
  navigationContentColor: colors.foreground,
  selectedDayContainerColor: colors.primary,
  selectedDayContentColor: colors.primaryForeground,
  selectedYearContainerColor: colors.primary,
  selectedYearContentColor: colors.primaryForeground,
  subheadContentColor: colors.foreground,
  titleContentColor: colors.mutedForeground,
  todayContentColor: colors.primary,
  todayDateBorderColor: colors.primary,
  weekdayContentColor: colors.mutedForeground,
  yearContentColor: colors.foreground,
};

/** "1st - 15th Oct, 2026", "28th Sep - 4th Oct, 2026" or the full dates across years. */
function rangeLabel({ from, to }: DateRange) {
  const [fromDay, fromMonth, fromYear] = formatDayLabel(from).replace(",", "").split(" ");
  const [toDay, toMonth, toYear] = formatDayLabel(to).replace(",", "").split(" ");
  if (fromYear !== toYear) return `${formatDayLabel(from)} - ${formatDayLabel(to)}`;
  if (fromMonth !== toMonth) return `${fromDay} ${fromMonth} - ${toDay} ${toMonth}, ${toYear}`;
  return `${fromDay} - ${toDay} ${toMonth}, ${toYear}`;
}

/**
 * "Select Date Range" until a range is applied, then the range with a clear button. Opens the
 * Material date range picker, limited to days up to today.
 */
export function DateRangeFilter({
  onChange,
  range,
  today,
}: {
  onChange: (range: DateRange | null) => void;
  range: DateRange | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View className="h-11 flex-row items-center self-start border border-border bg-card">
        <Pressable
          accessibilityLabel={range ? "Change date range" : "Select date range"}
          accessibilityRole="button"
          className="h-full flex-row items-center gap-2 px-3"
          onPress={() => setOpen(true)}
          onPressIn={() => haptic("light")}
        >
          <Text className="text-sm text-foreground">
            {range ? rangeLabel(range) : "Select Date Range"}
          </Text>
          <HugeiconsIcon
            color={colors.mutedForeground}
            icon={ArrowDown01Icon}
            size={18}
            strokeWidth={1.8}
          />
        </Pressable>
        {range ? (
          <Pressable
            accessibilityLabel="Clear date range"
            accessibilityRole="button"
            className="h-full w-10 items-center justify-center border-border border-l"
            onPress={() => {
              haptic("light");
              onChange(null);
            }}
          >
            <HugeiconsIcon
              color={colors.mutedForeground}
              icon={Cancel01Icon}
              size={16}
              strokeWidth={1.8}
            />
          </Pressable>
        ) : null}
      </View>
      {open ? (
        // The dialog is its own window; the host only has to mount it.
        <Host style={{ height: 0, position: "absolute", width: 0 }}>
          <DateRangePickerDialog
            color={colors.primary}
            confirmButtonLabel="Apply"
            dismissButtonLabel="Cancel"
            elementColors={pickerColors}
            initialEndDate={range ? dateOf(range.to).toISOString() : null}
            initialStartDate={range ? dateOf(range.from).toISOString() : null}
            onDateRangeSelected={({ end, start }) => {
              setOpen(false);
              if (start && end) onChange({ from: isoOf(start), to: isoOf(end) });
            }}
            onDismissRequest={() => setOpen(false)}
            selectableDates={{ end: dateOf(today) }}
            showVariantToggle={false}
          />
        </Host>
      ) : null}
    </>
  );
}
