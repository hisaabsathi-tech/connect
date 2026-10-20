import { Image02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { AttendanceSession } from "@/lib/api/attendance";
import { formatDayLabel, formatDuration, formatTime } from "@/lib/date";

import type { DayKind } from "../hooks/use-day-attendance";
import {
  checkInRemarks,
  checkOutRemarks,
  type DayStateTone,
  dayStateWithoutRecord,
  type Remark,
} from "../lib/remarks";
import { RemarkBadge } from "./remark-badge";

interface DayRecordProps {
  date: string;
  kind: DayKind;
  record: AttendanceSession | null;
  offDay: string | null;
  loading: boolean;
  failed: boolean;
  /** Opens the record's check-in or check-out photo; only offered where one was taken. */
  onOpenPhoto?: (side: PhotoSide) => void;
}

export type PhotoSide = "checkIn" | "checkOut";

// Absent, holidays and the plain states (weekly off, upcoming, today) as in the design.
const tones: Record<DayStateTone, { box: string; label: string; value: string }> = {
  absent: {
    box: "border-destructive bg-[#FFF1F2]",
    label: "text-destructive",
    value: "text-destructive",
  },
  holiday: {
    box: "border-[#D97706] bg-[#FFF8ED]",
    label: "text-[#C2410C]",
    value: "text-[#C2410C]",
  },
  plain: { box: "border-border bg-card", label: "text-muted-foreground", value: "text-foreground" },
};

function StateBlock({ label, tone, value }: { label: string; tone: DayStateTone; value: string }) {
  const style = tones[tone];
  return (
    // Full-width lines centred by text-align, not shrink-wrapped by `items-center`: Android
    // measures a wrapped Satoshi line narrower than it draws and clips the end of it.
    <View className={`border px-4 py-10 ${style.box}`}>
      <Text className={`text-center text-md ${style.label}`}>{label}</Text>
      <Text className={`mt-1 text-center text-xl font-semibold ${style.value}`}>{value}</Text>
    </View>
  );
}

function Stat({
  label,
  onPress,
  remarks,
  value,
}: {
  label: string;
  /** Set when the card has a photo: the card opens it, and an image icon says so. */
  onPress?: () => void;
  remarks: Remark[];
  value: string;
}) {
  return (
    <Pressable
      accessibilityHint={onPress ? "Shows the photo you took" : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      className="flex-1 border border-[#E6E9F8] bg-card p-3 active:bg-[#F3F5FF]"
      disabled={!onPress}
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-muted-foreground">{label}</Text>
        {onPress ? (
          <HugeiconsIcon color={colors.primary} icon={Image02Icon} size={18} strokeWidth={1.8} />
        ) : null}
      </View>
      <Text className="mt-1 text-xl font-medium text-foreground">{value}</Text>
      <View className="mt-2 flex-row flex-wrap gap-1.5">
        {remarks.map((remark) => (
          <RemarkBadge key={remark.label} {...remark} />
        ))}
      </View>
    </Pressable>
  );
}

/** Ticks every second while `open`, for a session that is still running. */
function useLiveNow(open: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);
  return now;
}

function RecordCards({
  date,
  kind,
  onOpenPhoto,
  record,
}: {
  date: string;
  kind: DayKind;
  onOpenPhoto?: (side: PhotoSide) => void;
  record: AttendanceSession;
}) {
  // Still working today: the second card counts the hours live instead of a check-out time.
  const working = !record.checkOutAt && kind === "today";
  const now = useLiveNow(working);
  const checkOutValue = working
    ? formatDuration(record.checkInAt, null, now)
    : record.checkOutAt
      ? formatTime(record.checkOutAt)
      : "—";
  return (
    <>
      <View className="flex-row gap-2">
        <Stat
          label="Check In"
          onPress={onOpenPhoto && record.hasCheckInPhoto ? () => onOpenPhoto("checkIn") : undefined}
          remarks={checkInRemarks(record)}
          value={formatTime(record.checkInAt)}
        />
        <Stat
          label={working ? "Hours Worked" : "Check Out"}
          onPress={
            onOpenPhoto && record.hasCheckOutPhoto ? () => onOpenPhoto("checkOut") : undefined
          }
          remarks={checkOutRemarks(record, kind)}
          value={checkOutValue}
        />
      </View>
      {record.checkOutAt ? (
        <View className="mt-4 border border-success bg-[#ECFDF5] px-4 py-4">
          <Text className="text-center text-base font-medium text-foreground">
            Attendance completed for {kind === "today" ? "today" : formatDayLabel(date)}
          </Text>
          <Text className="text-center text-2xl font-medium text-success">
            {formatDuration(record.checkInAt, record.checkOutAt)}
          </Text>
          <Text className="text-center text-xs text-muted-foreground">
            {kind === "today" ? "hours worked today" : "hours worked"}
          </Text>
        </View>
      ) : null}
    </>
  );
}

/**
 * The selected day's attendance: check-in and check-out side by side (with the web table's
 * remarks) and the hours worked once closed, or a single block for a day without a record.
 */
export function DayRecord({
  date,
  failed,
  kind,
  loading,
  offDay,
  onOpenPhoto,
  record,
}: DayRecordProps) {
  let content: ReactNode;
  if (loading)
    content = (
      <View className="h-[84px] items-center justify-center border border-[#E6E9F8] bg-card">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  else if (failed)
    content = (
      <StateBlock label="Couldn't load attendance" tone="plain" value="Pull down to retry" />
    );
  else if (record)
    content = <RecordCards date={date} kind={kind} onOpenPhoto={onOpenPhoto} record={record} />;
  else content = <StateBlock {...dayStateWithoutRecord(kind, offDay)} />;
  return <View className="mt-2">{content}</View>;
}
