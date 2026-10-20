import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { HapticButton } from "@/components/modules/button";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { addDays, formatDayLabel, startOfMonth, startOfWeek } from "@/lib/date";
import { haptic } from "@/lib/haptics";

import type { DateRange } from "../hooks/use-attendance-range";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The first day of the month `months` away from `month` (a month's first day). */
function shiftMonth(month: string, months: number) {
  const date = new Date(`${month}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

/** The month's days in Monday-first weeks, with nulls before the 1st and after the last day. */
function monthGrid(month: string) {
  const last = addDays(shiftMonth(month, 1), -1);
  const leading = (new Date(`${month}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = month; day <= last; day = addDays(day, 1)) cells.push(day);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function presetsFor(today: string): { label: string; range: DateRange }[] {
  const lastMonth = shiftMonth(startOfMonth(today), -1);
  return [
    { label: "This Week", range: { from: startOfWeek(today), to: today } },
    { label: "This Month", range: { from: startOfMonth(today), to: today } },
    {
      label: "Last Month",
      range: { from: lastMonth, to: addDays(startOfMonth(today), -1) },
    },
    { label: "Last 30 Days", range: { from: addDays(today, -29), to: today } },
  ];
}

type Draft = { from: string | null; to: string | null };

function DayCell({
  date,
  draft,
  onPress,
  today,
}: {
  date: string | null;
  draft: Draft;
  onPress: (date: string) => void;
  today: string;
}) {
  if (!date) return <View className="h-11 w-[14.2857%]" />;
  const future = date > today;
  const end = date === draft.from || date === draft.to;
  const between = Boolean(draft.from && draft.to && date > draft.from && date < draft.to);
  return (
    <Pressable
      accessibilityLabel={formatDayLabel(date, "long")}
      accessibilityRole="button"
      accessibilityState={{ disabled: future, selected: end }}
      className={`h-11 w-[14.2857%] items-center justify-center ${end ? "bg-primary" : between ? "bg-accent" : ""} ${date === today && !end ? "border border-primary" : ""}`}
      disabled={future}
      onPress={() => onPress(date)}
    >
      <Text
        className={`text-sm ${end ? "font-semibold text-primary-foreground" : future ? "text-[#C3C7D4]" : date === today ? "font-semibold text-primary" : "text-foreground"}`}
      >
        {Number(date.slice(8, 10))}
      </Text>
    </Pressable>
  );
}

/**
 * The app's own date range picker in a bottom sheet: quick presets, then a Monday-first month
 * calendar where the first tap picks the start and the second the end. Days after today can't be
 * picked. Apply hands the range back; Cancel or closing keeps the previous one.
 */
export function DateRangeSheet({
  onApply,
  onClose,
  range,
  today,
  visible,
}: {
  onApply: (range: DateRange) => void;
  onClose: () => void;
  range: DateRange | null;
  today: string;
  visible: boolean;
}) {
  const [draft, setDraft] = useState<Draft>({ from: range?.from ?? null, to: range?.to ?? null });
  const [month, setMonth] = useState(startOfMonth(range?.to ?? today));
  // Opening again starts from the applied range, not an abandoned draft.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft({ from: range?.from ?? null, to: range?.to ?? null });
      setMonth(startOfMonth(range?.to ?? today));
    }
  }

  const pick = (date: string) => {
    haptic("selection");
    setDraft((current) => {
      // A new start after a complete range, or before the current start.
      if (!current.from || current.to || date < current.from) return { from: date, to: null };
      return { from: current.from, to: date };
    });
  };

  const presets = presetsFor(today);
  const currentMonth = startOfMonth(today);
  const complete = draft.from && draft.to ? { from: draft.from, to: draft.to } : null;
  const monthIndex = Number(month.slice(5, 7)) - 1;

  return (
    <BottomSheet onClose={onClose} visible={visible}>
      <Text className="mt-4 text-xl font-semibold leading-7 text-foreground">
        Select Date Range
      </Text>
      <Text className="mt-0.5 text-sm text-muted-foreground">
        {draft.from
          ? `${formatDayLabel(draft.from)} - ${draft.to ? formatDayLabel(draft.to) : "pick an end date"}`
          : "Pick a start date"}
      </Text>

      <ScrollView
        className="mt-4 -mx-5"
        contentContainerClassName="gap-2 px-5"
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {presets.map((preset) => {
          const active = complete?.from === preset.range.from && complete?.to === preset.range.to;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`h-9 justify-center border px-3 ${active ? "border-primary bg-accent" : "border-border bg-card"}`}
              key={preset.label}
              onPress={() => {
                haptic("selection");
                setDraft(preset.range);
                setMonth(startOfMonth(preset.range.to));
              }}
            >
              <Text className={`text-sm ${active ? "text-primary" : "text-foreground"}`}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mt-4 flex-row items-center justify-between">
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          className="h-9 w-9 items-center justify-center border border-border bg-card"
          onPress={() => setMonth(shiftMonth(month, -1))}
        >
          <HugeiconsIcon color={colors.foreground} icon={ArrowLeft01Icon} size={18} />
        </Pressable>
        <Text className="text-base font-semibold text-foreground">
          {MONTHS[monthIndex]} {month.slice(0, 4)}
        </Text>
        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          className={`h-9 w-9 items-center justify-center border border-border bg-card ${month >= currentMonth ? "opacity-40" : ""}`}
          disabled={month >= currentMonth}
          onPress={() => setMonth(shiftMonth(month, 1))}
        >
          <HugeiconsIcon color={colors.foreground} icon={ArrowRight01Icon} size={18} />
        </Pressable>
      </View>

      <View className="mt-3 flex-row">
        {WEEKDAYS.map((weekday, index) => (
          <Text
            className="w-[14.2857%] text-center text-xs font-medium text-muted-foreground"
            key={index}
          >
            {weekday}
          </Text>
        ))}
      </View>
      <View className="mt-1 flex-row flex-wrap">
        {monthGrid(month).map((date, index) => (
          <DayCell
            date={date}
            draft={draft}
            key={date ?? `blank-${index}`}
            onPress={pick}
            today={today}
          />
        ))}
      </View>

      <View className="mt-5 flex-row gap-3">
        <HapticButton kind="light" label="Cancel" onPress={onClose} />
        <HapticButton
          disabled={!complete}
          kind="medium"
          label="Apply"
          onPress={() => {
            if (complete) onApply(complete);
          }}
          tone="brand"
        />
      </View>
    </BottomSheet>
  );
}
