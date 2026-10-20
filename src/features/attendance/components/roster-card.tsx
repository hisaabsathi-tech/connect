import { Pressable, View } from "react-native";

import { RemarkBadge } from "@/components/modules/remark-badge";
import { Text } from "@/components/modules/typography";
import type { RosterRow } from "@/lib/api/attendance-roster";
import { attendedDayRemarks, dayKindOf, isWeeklyOff, type Remark } from "@/lib/attendance/remarks";
import { formatClock, formatDayLabel } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import { humanizeLabel } from "@/lib/text";

import { recordOfRow } from "../lib/roster";
import { shortAddress, TimeSide } from "./attendance-day-card";

/** The pill in the card's top right: Present, Absent, or the kind of day off. */
function statusRemark(row: RosterRow): Remark {
  if (row.status === "PRESENT") return { label: "Present", variant: "delivered" };
  if (row.status === "ABSENT") return { label: "Absent", variant: "destructive" };
  return row.holidayName && isWeeklyOff(row.holidayName)
    ? { label: "Weekly Off", variant: "transit" }
    : { label: "Holiday", variant: "rescheduled" };
}

/**
 * One employee on one day of the roster: name and role with the day's status in the corner;
 * when present, check-in and check-out times with their places and the remarks. `showDate` adds
 * the day, for a date range. With `onPress` the card opens the locations and photos.
 */
export function RosterCard({
  onPress,
  row,
  showDate,
  today,
}: {
  onPress?: () => void;
  row: RosterRow;
  showDate: boolean;
  today: string;
}) {
  const record = recordOfRow(row);
  const remarks = record ? attendedDayRemarks(record, dayKindOf(row.date, today)) : [];
  const holidayName =
    row.status === "HOLIDAY" && row.holidayName && !isWeeklyOff(row.holidayName)
      ? row.holidayName
      : null;
  return (
    <Pressable
      accessibilityHint={onPress ? "Shows the locations and photos" : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      className="border border-[#EEF0F6] bg-card p-4 active:bg-[#F7F8FF]"
      disabled={!onPress}
      onPress={onPress}
      onPressIn={onPress ? () => haptic("light") : undefined}
      style={{ elevation: 1 }}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold leading-6 text-foreground" numberOfLines={1}>
            {row.name}
          </Text>
          <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={1}>
            {humanizeLabel(row.role)}
          </Text>
        </View>
        <RemarkBadge {...statusRemark(row)} />
      </View>
      {record ? (
        <View className="mt-4 flex-row">
          <TimeSide
            address={shortAddress(record.checkInAddress)}
            align="left"
            hasPhoto={row.hasCheckInPhoto}
            label="Check-In Time"
            time={formatClock(record.checkInAt)}
          />
          <View className="mx-3 my-3 w-px bg-border" />
          <TimeSide
            address={shortAddress(record.checkOutAddress)}
            align="right"
            hasPhoto={row.hasCheckOutPhoto}
            label="Check-Out Time"
            time={record.checkOutAt ? formatClock(record.checkOutAt) : "--"}
          />
        </View>
      ) : null}
      {remarks.length || holidayName || showDate ? (
        <View className="mt-4 flex-row items-center gap-3">
          <View className="flex-1 flex-row flex-wrap items-center gap-2">
            {remarks.map((remark) => (
              <RemarkBadge key={remark.label} {...remark} />
            ))}
            {holidayName ? (
              <Text className="flex-shrink text-sm font-medium text-foreground" numberOfLines={1}>
                {holidayName}
              </Text>
            ) : null}
          </View>
          {showDate ? (
            <Text className="text-xs text-muted-foreground">
              {formatDayLabel(row.date, "long")}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
