import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { formatDayLabel } from "@/lib/date";
import { haptic } from "@/lib/haptics";

import type { DateRange } from "../hooks/use-attendance-range";
import { DateRangeSheet } from "./date-range-sheet";

/** "1st - 15th Oct, 2026", "28th Sep - 4th Oct, 2026" or the full dates across years. */
export function rangeLabel({ from, to }: DateRange) {
  const [fromDay, fromMonth, fromYear] = formatDayLabel(from).replace(",", "").split(" ");
  const [toDay, toMonth, toYear] = formatDayLabel(to).replace(",", "").split(" ");
  if (fromYear !== toYear) return `${formatDayLabel(from)} - ${formatDayLabel(to)}`;
  if (fromMonth !== toMonth) return `${fromDay} ${fromMonth} - ${toDay} ${toMonth}, ${toYear}`;
  return `${fromDay} - ${toDay} ${toMonth}, ${toYear}`;
}

/**
 * "Select Date Range" until a range is applied, then the range with a clear button. Opens the
 * app's own date range sheet, limited to days up to today.
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
          className="h-full flex-row items-center gap-3 px-4"
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
      <DateRangeSheet
        onApply={(next) => {
          setOpen(false);
          onChange(next);
        }}
        onClose={() => setOpen(false)}
        range={range}
        today={today}
        visible={open}
      />
    </>
  );
}
