import { Image02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable, View } from "react-native";

import { RemarkBadge } from "@/components/modules/remark-badge";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { attendedDayRemarks, unattendedDayRemark } from "@/lib/attendance/remarks";
import { formatClock, formatDayLabel } from "@/lib/date";

import type { AttendanceDayEntry } from "../lib/days";

export type PhotoSide = "checkIn" | "checkOut";

/** "Madhya Kalyanpur, Baruipur": the first two parts of a reverse-geocoded address. */
function shortAddress(address: string | null | undefined) {
  if (!address) return null;
  return address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

function Side({
  address,
  align,
  label,
  onOpenPhoto,
  time,
}: {
  address: string | null;
  align: "left" | "right";
  label: string;
  /** Set when a photo was taken: the side opens it, and an image icon says so. */
  onOpenPhoto?: () => void;
  time: string;
}) {
  const right = align === "right";
  return (
    <Pressable
      accessibilityHint={onOpenPhoto ? "Shows the photo you took" : undefined}
      accessibilityRole={onOpenPhoto ? "button" : undefined}
      className={`flex-1 ${right ? "items-end" : ""}`}
      disabled={!onOpenPhoto}
      onPress={onOpenPhoto}
    >
      <View className={`flex-row items-center gap-1.5 ${right ? "flex-row-reverse" : ""}`}>
        <Text className="text-sm text-muted-foreground">{label}</Text>
        {onOpenPhoto ? (
          <HugeiconsIcon color={colors.primary} icon={Image02Icon} size={15} strokeWidth={1.8} />
        ) : null}
      </View>
      <Text className="mt-0.5 text-xl font-semibold leading-7 text-foreground">{time}</Text>
      {address ? (
        <Text
          className={`mt-0.5 w-full text-xs text-primary ${right ? "text-right" : ""}`}
          numberOfLines={1}
        >
          {address}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * One day in the list: check-in and check-out times with where they happened, the remarks and
 * the date. A day without attendance shows only why (absent, holiday, weekly off) and the date.
 */
export function AttendanceDayCard({
  day,
  onOpenPhoto,
}: {
  day: AttendanceDayEntry;
  onOpenPhoto: (side: PhotoSide) => void;
}) {
  const { record } = day;
  const remarks = record
    ? attendedDayRemarks(record, day.kind)
    : [unattendedDayRemark(day.kind, day.offDay)];
  const holidayName = !record && remarks[0].label === "Public Holiday" ? day.offDay : null;
  return (
    <View className="border border-[#EEF0F6] bg-card p-4" style={{ elevation: 1 }}>
      {record ? (
        <View className="mb-4 flex-row">
          <Side
            address={shortAddress(record.checkInAddress)}
            align="left"
            label="Check-In Time"
            onOpenPhoto={record.hasCheckInPhoto ? () => onOpenPhoto("checkIn") : undefined}
            time={formatClock(record.checkInAt)}
          />
          <View className="mx-3 my-3 w-px bg-border" />
          <Side
            address={shortAddress(record.checkOutAddress)}
            align="right"
            label="Check-Out Time"
            onOpenPhoto={record.hasCheckOutPhoto ? () => onOpenPhoto("checkOut") : undefined}
            time={record.checkOutAt ? formatClock(record.checkOutAt) : "--"}
          />
        </View>
      ) : null}
      <View className="flex-row items-center gap-3">
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
        <Text className="text-xs text-muted-foreground">{formatDayLabel(day.date, "long")}</Text>
      </View>
    </View>
  );
}
