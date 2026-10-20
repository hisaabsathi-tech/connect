import { ActivityIndicator, Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { formatClock, formatDayLabel, formatHours } from "@/lib/date";

import { type AttendanceDayEntry, workedMs } from "../lib/days";

// Share of the row each column takes; three columns fit the screen without scrolling sideways.
const COLUMNS = [
  { flex: 1.5, label: "Date" },
  { flex: 1, label: "Check In" },
  { flex: 1, label: "Check Out" },
] as const;

function Row({ day }: { day: AttendanceDayEntry }) {
  const { record } = day;
  const cells = [
    formatDayLabel(day.date),
    record ? formatClock(record.checkInAt) : "--",
    record?.checkOutAt ? formatClock(record.checkOutAt) : "--",
  ];
  return (
    <View className="flex-row border-border border-b bg-card">
      {COLUMNS.map((column, index) => (
        <View className="px-3 py-3.5" key={column.label} style={{ flex: column.flex }}>
          <Text
            className={`text-sm text-foreground ${index ? "" : "font-medium"}`}
            numberOfLines={1}
          >
            {cells[index]}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The applied date range as a table, one row per attended day oldest first (absent days, holidays
 * and weekly offs are left out), with the range's totals above it. Shown in place of the day
 * cards while a range filter is on.
 */
export function AttendanceTable({
  days,
  failed,
  loading,
  onRetry,
  today,
}: {
  days: AttendanceDayEntry[];
  failed: boolean;
  loading: boolean;
  onRetry: () => void;
  today: string;
}) {
  if (loading)
    return (
      <View className="mt-4 h-40 items-center justify-center border border-border bg-card">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (failed)
    return (
      <Pressable
        accessibilityRole="button"
        className="mt-4 items-center border border-border bg-card px-4 py-8"
        onPress={onRetry}
      >
        <Text className="text-base font-medium text-foreground">Couldn't load this range</Text>
        <Text className="mt-1 text-sm text-primary">Tap to try again</Text>
      </Pressable>
    );
  const attended = days.filter((day) => day.record);
  const worked = days.reduce(
    (total, day) => total + (day.record ? workedMs(day.record, today) : 0),
    0,
  );
  return (
    <View className="mt-4">
      <Text className="mb-2 text-sm text-muted-foreground">
        {days.length} {days.length === 1 ? "day" : "days"} · {attended.length} present ·{" "}
        {formatHours(worked)} hrs worked
      </Text>
      <View className="border-border border-x border-t">
        <View className="flex-row border-border border-b bg-accent">
          {COLUMNS.map((column) => (
            <View className="px-3 py-2.5" key={column.label} style={{ flex: column.flex }}>
              <Text
                className="text-xs font-semibold uppercase tracking-[0.3px] text-foreground"
                numberOfLines={1}
              >
                {column.label}
              </Text>
            </View>
          ))}
        </View>
        {attended.length ? (
          attended.map((day) => <Row day={day} key={day.date} />)
        ) : (
          <View className="border-border border-b bg-card px-3 py-6">
            <Text className="text-center text-sm text-muted-foreground">
              No attendance in this range
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
