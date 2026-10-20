import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { AttendanceSession } from "@/lib/api/attendance";
import { formatDayLabel, formatDuration, formatTime } from "@/lib/date";

import type { DayKind } from "../hooks/use-day-attendance";
import { checkInRemarks, checkOutRemarks, type Remark } from "../lib/remarks";
import { RemarkBadge } from "./remark-badge";

interface DayRecordProps {
  date: string;
  kind: DayKind;
  record: AttendanceSession | null;
  offDay: string | null;
  loading: boolean;
  failed: boolean;
}

function Stat({
  label,
  loading,
  remarks,
  value,
}: {
  label: string;
  loading: boolean;
  remarks: Remark[];
  value: string;
}) {
  return (
    <View className="flex-1 p-4">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <View className="mt-2 h-8 justify-center">
        {loading ? (
          <ActivityIndicator className="self-start" color={colors.primary} size="small" />
        ) : (
          <Text className="text-2xl font-medium text-foreground">{value}</Text>
        )}
      </View>
      {!loading && remarks.length ? (
        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {remarks.map((remark) => (
            <RemarkBadge key={remark.label} {...remark} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Hours worked: a green "completed" box once checked out, a live blue one while working today. */
function WorkedSummary({
  date,
  kind,
  record,
}: {
  date: string;
  kind: DayKind;
  record: AttendanceSession;
}) {
  const open = !record.checkOutAt;
  // An open session's working time keeps counting, to the second.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  // The server closes forgotten sessions; an open one on another day has nothing live to show.
  if (open && kind !== "today") return null;
  const today = kind === "today";
  return (
    <View
      className={`mt-6 items-center border px-4 py-5 ${open ? "border-primary bg-[#EFF2FF]" : "border-success bg-[#ECFDF5]"}`}
    >
      <Text className="text-center text-lg font-medium text-foreground">
        {open
          ? "You're checked in"
          : `Attendance completed for ${today ? "today" : formatDayLabel(date)}`}
      </Text>
      <Text className={`mt-1 text-3xl font-medium ${open ? "text-primary" : "text-success"}`}>
        {formatDuration(record.checkInAt, record.checkOutAt, now)}
      </Text>
      <Text className="mt-1 text-sm text-muted-foreground">
        {open ? "hours worked so far" : today ? "hours worked today" : "hours worked"}
      </Text>
    </View>
  );
}

/**
 * Check-in and check-out for the calendar's selected day, always as two cards ("—" without a
 * record), with the same remarks as the web attendance table, then the hours worked.
 */
export function DayRecord({ date, failed, kind, loading, offDay, record }: DayRecordProps) {
  const day = { kind, offDay, record };
  return (
    <View className="mt-4">
      <View className="flex-row border border-[#E6E9F8] bg-card">
        <Stat
          label="Check In"
          loading={loading}
          remarks={failed ? [] : checkInRemarks(day)}
          value={record ? formatTime(record.checkInAt) : "—"}
        />
        <View className="w-px bg-[#E6E9F8]" />
        <Stat
          label="Check Out"
          loading={loading}
          remarks={failed ? [] : checkOutRemarks(day)}
          value={record?.checkOutAt ? formatTime(record.checkOutAt) : "—"}
        />
      </View>
      {failed ? (
        <Text className="mt-3 text-center text-sm text-muted-foreground">
          Couldn't load attendance. Pull down to retry.
        </Text>
      ) : null}
      {record && !loading ? <WorkedSummary date={date} kind={kind} record={record} /> : null}
    </View>
  );
}
