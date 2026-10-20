import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { type DateRange, DateRangeSheet, rangeLabel } from "@/components/modules/date-range";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { haptic } from "@/lib/haptics";

// The button's minimum share of the page width, so it reads as a proper filter field.
const MIN_WIDTH_SHARE = 0.6;

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
  const { width } = useWindowDimensions();
  return (
    <>
      <View
        className="h-11 flex-row items-center self-start border border-border bg-card"
        // At least 60% of the page's content width (screen minus its 20pt side padding); a longer
        // range label still widens it.
        style={{ minWidth: Math.round((width - 40) * MIN_WIDTH_SHARE) }}
      >
        <Pressable
          accessibilityLabel={range ? "Change date range" : "Select date range"}
          accessibilityRole="button"
          className="h-full flex-1 flex-row items-center justify-between gap-3 px-4"
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
