import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { StatCard } from "@/components/modules/stat-card";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { formatHoursMinutes } from "@/lib/date";
import { haptic } from "@/lib/haptics";

import { type AttendanceSummary as Summary, showsAverageDay, workedSoFarMs } from "../lib/days";

/** Page title, with the Holiday List button when the organisation has holidays configured. */
export function AttendanceHeader({ onOpenHolidays }: { onOpenHolidays?: () => void }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="flex-1">
        <Text className="text-2xl font-semibold leading-8 text-foreground">Attendance</Text>
        <Text className="mt-0.5 text-sm text-muted-foreground">View your attendance records</Text>
      </View>
      {onOpenHolidays ? (
        <Pressable
          accessibilityRole="button"
          className="h-10 flex-row items-center gap-2 border border-primary bg-[#F3F5FF] px-3 active:bg-accent"
          onPress={onOpenHolidays}
          onPressIn={() => haptic("light")}
        >
          <Text className="text-sm font-medium text-primary">Holiday List</Text>
          <HugeiconsIcon color={colors.primary} icon={Calendar03Icon} size={18} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

// The hours show minutes at most, so a live session refreshes them this often.
const LIVE_TICK_MS = 30_000;

/** Ticks while `live`, for hours that are still adding up. */
function useLiveNow(live: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(timer);
  }, [live]);
  return now;
}

/**
 * Days present out of all the days, and the time worked in hours and minutes, counting up live
 * while today's session is open. By default for this month and the last 7 days; with a range
 * applied, both for that range. Once more than 5 days are worked, the hours card shows the
 * average worked day instead of the total.
 */
export function AttendanceSummaryCards({
  ranged,
  summary,
}: {
  /** A date range is applied: both cards describe it instead of this month and week. */
  ranged: boolean;
  summary: Summary | null;
}) {
  const now = useLiveNow(Boolean(summary?.openSince));
  const average = summary ? showsAverageDay(summary) : false;
  return (
    <View className="mt-5 flex-row gap-3">
      <StatCard
        label="Present Days"
        value={summary ? `${summary.presentDays}/${summary.totalDays}` : "--"}
      />
      <StatCard
        label={
          average
            ? ranged
              ? "Avg Daily Hrs"
              : "Avg Daily Hrs (7 Days)"
            : ranged
              ? "Total Working Hrs"
              : "Last 7 Days Hrs"
        }
        value={
          summary
            ? formatHoursMinutes(
                average
                  ? workedSoFarMs(summary, now) / summary.workedDays
                  : workedSoFarMs(summary, now),
              )
            : "--"
        }
      />
    </View>
  );
}
