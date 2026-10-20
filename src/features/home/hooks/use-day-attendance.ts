import { useCallback, useEffect, useRef, useState } from "react";

import { type AttendanceSession, fetchMyAttendanceOn } from "@/lib/api/attendance";
import { type DayKind, dayKindOf } from "@/lib/attendance/remarks";

export type { DayKind };

/**
 * The signed-in member's attendance record for the calendar's selected day, plus whether the
 * organisation's calendar marks it off (holiday or weekly off). Future days are fetched too, so
 * an upcoming holiday shows as one.
 */
export function useDayAttendance(token: string | null, date: string, today: string) {
  const kind = dayKindOf(date, today);
  const [record, setRecord] = useState<AttendanceSession | null>(null);
  const [offDay, setOffDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Only the latest request may update state, so quickly tapping through days can't show an
  // older day's record.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setFailed(false);
    // Clear the previous day at once; its record must not show under the new date.
    setRecord(null);
    setOffDay(null);
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchMyAttendanceOn(token, date);
      if (request === latestRequest.current) {
        setRecord(next.record);
        setOffDay(next.offDay);
      }
    } catch {
      if (request === latestRequest.current) setFailed(true);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [date, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { failed, kind, loading, offDay, record, reload: load };
}
