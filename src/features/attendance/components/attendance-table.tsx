import { View } from "react-native";
import { EmptyBlock } from "@/components/modules/empty-state";
import { Text } from "@/components/modules/typography";
import { formatClock, formatDayLabel } from "@/lib/date";
import type { AttendanceDayEntry } from "../lib/days";

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
 * and weekly offs are left out). Shown in place of the day cards while a range filter is on;
 * loading, an error or a range without attendance fill the table's body instead of rows.
 */
export function AttendanceTable({
  days,
  failed,
  loading,
  onRetry,
}: {
  days: AttendanceDayEntry[];
  failed: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  const attended = days.filter((day) => day.record);
  return (
    <View className="mt-4 border-border border-x border-t">
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
      {loading ? (
        <View className="border-border border-b">
          <EmptyBlock variant="table" />
        </View>
      ) : failed ? (
        <View className="border-border border-b">
          <EmptyBlock
            action={{ label: "Try again", onPress: onRetry }}
            description="Check your connection and try again."
            title="Couldn't load this range"
            variant="table"
          />
        </View>
      ) : attended.length ? (
        attended.map((day) => <Row day={day} key={day.date} />)
      ) : (
        <View className="border-border border-b">
          <EmptyBlock
            description="There are no check-ins between these dates."
            title="No attendance in this range"
            variant="table"
          />
        </View>
      )}
    </View>
  );
}
