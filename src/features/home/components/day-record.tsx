import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { AttendanceSession } from "@/lib/api/attendance";
import { formatDuration, formatTime } from "@/lib/date";

import type { DayKind } from "../hooks/use-day-attendance";

interface DayRecordProps {
  kind: DayKind;
  record: AttendanceSession | null;
  loading: boolean;
  failed: boolean;
}

const emptyMessages: Record<DayKind, string> = {
  future: "This day hasn't started yet.",
  past: "No attendance recorded on this day.",
  today: "You haven't checked in today.",
};

function Badge({ label, tone }: { label: string; tone: "success" | "primary" | "warning" }) {
  const tones = {
    primary: "bg-[#E9ECFF] text-primary",
    success: "bg-[#EDF8F0] text-success",
    warning: "bg-[#FFF4E5] text-[#C2700A]",
  };
  return (
    <Text className={`mt-3 self-start px-2 py-1 text-[11px] font-medium uppercase ${tones[tone]}`}>
      {label}
    </Text>
  );
}

function Stat({ children, label, value }: { children?: ReactNode; label: string; value: string }) {
  return (
    <View className="flex-1 border border-[#E6E9F8] bg-card p-4">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="mt-2 text-2xl font-medium text-foreground">{value}</Text>
      {children}
    </View>
  );
}

/** Check-in time and hours worked for the calendar's selected day. */
export function DayRecord({ failed, kind, loading, record }: DayRecordProps) {
  const open = Boolean(record && !record.checkOutAt);
  // An open session's working time keeps counting, to the second.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (loading && !record)
    return (
      <View className="mt-4 h-[118px] items-center justify-center border border-[#E6E9F8] bg-card">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (!record)
    return (
      <View className="mt-4 items-center justify-center border border-[#E6E9F8] bg-card px-4 py-6">
        <Text className="text-sm text-muted-foreground">
          {failed ? "Couldn't load attendance. Pull down to retry." : emptyMessages[kind]}
        </Text>
      </View>
    );
  return (
    <View className="mt-4 flex-row gap-3">
      <Stat label="Check In" value={formatTime(record.checkInAt)}>
        <Badge
          label={record.checkOutAt ? `Out ${formatTime(record.checkOutAt)}` : "Not checked out"}
          tone={record.checkOutAt ? "primary" : "warning"}
        />
      </Stat>
      <Stat label="Working Hrs" value={formatDuration(record.checkInAt, record.checkOutAt, now)}>
        <Badge
          label={open ? "Working" : record.checkOutKind === "AUTO" ? "Auto checkout" : "Completed"}
          tone={open ? "success" : record.checkOutKind === "AUTO" ? "warning" : "primary"}
        />
      </Stat>
    </View>
  );
}
