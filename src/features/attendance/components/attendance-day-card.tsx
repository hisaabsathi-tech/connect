import { Image02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable, View } from "react-native";

import { RemarkBadge } from "@/components/modules/remark-badge";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { attendedDayRemarks, unattendedDayRemark } from "@/lib/attendance/remarks";
import { formatClock, formatDayLabel } from "@/lib/date";
import { haptic } from "@/lib/haptics";

import type { AttendanceDayEntry } from "../lib/days";

/** "Madhya Kalyanpur, Baruipur": the first two parts of a reverse-geocoded address. */
export function shortAddress(address: string | null | undefined) {
  if (!address) return null;
  return address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

export function TimeSide({
  address,
  align,
  hasPhoto,
  label,
  time,
}: {
  address: string | null;
  align: "left" | "right";
  /** A photo was taken: an image icon says so (the card's sheet shows it). */
  hasPhoto: boolean;
  label: string;
  time: string;
}) {
  const right = align === "right";
  return (
    <View className={`flex-1 ${right ? "items-end" : ""}`}>
      <View className={`flex-row items-center gap-1.5 ${right ? "flex-row-reverse" : ""}`}>
        <Text className="text-sm text-muted-foreground">{label}</Text>
        {hasPhoto ? (
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
    </View>
  );
}

/**
 * One day in the list: check-in and check-out times with where they happened, the remarks and
 * the date. A day without attendance shows only why (absent, holiday, weekly off) and the date.
 * With `onPress` (the day has locations or photos) the card opens their details.
 */
export function AttendanceDayCard({
  day,
  onPress,
}: {
  day: AttendanceDayEntry;
  onPress?: () => void;
}) {
  const { record } = day;
  const remarks = record
    ? attendedDayRemarks(record, day.kind)
    : [unattendedDayRemark(day.kind, day.offDay)];
  const holidayName = !record && remarks[0].label === "Public Holiday" ? day.offDay : null;
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
      {record ? (
        <View className="mb-4 flex-row">
          <TimeSide
            address={shortAddress(record.checkInAddress)}
            align="left"
            label="Check-In Time"
            hasPhoto={Boolean(record.hasCheckInPhoto)}
            time={formatClock(record.checkInAt)}
          />
          <View className="mx-3 my-3 w-px bg-border" />
          <TimeSide
            address={shortAddress(record.checkOutAddress)}
            align="right"
            label="Check-Out Time"
            hasPhoto={Boolean(record.hasCheckOutPhoto)}
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
        <Text className="text-xs font-semibold text-muted-foreground">
          {formatDayLabel(day.date, "long")}
        </Text>
      </View>
    </Pressable>
  );
}
