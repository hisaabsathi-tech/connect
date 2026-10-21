import { useCallback, useEffect, useRef, useState } from "react";

import { type AttendanceSession, fetchMyAttendanceOn } from "@/lib/api/attendance";
import { type DayKind, dayKindOf } from "@/lib/attendance/remarks";
import { onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";

const DAY_CACHE = "day-attendance";

type DaySnapshot = Awaited<ReturnType<typeof fetchMyAttendanceOn>>;

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
  // Loading from the first render (the fetch starts in an effect), so the page never shows an
  // empty day before it.
  const [loading, setLoading] = useState(Boolean(token));
  const [failed, setFailed] = useState(false);
  // Only the latest request may update state, so quickly tapping through days can't show an
  // older day's record.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setFailed(false);
    // The day as saved last time shows at once (offline it stays); otherwise the previous day is
    // cleared, as its record must not show under the new date.
    const saved = readCache<DaySnapshot>(DAY_CACHE, date)?.data ?? null;
    setRecord(saved?.record ?? null);
    setOffDay(saved?.offDay ?? null);
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(!saved);
    try {
      const next = await fetchMyAttendanceOn(token, date);
      writeCache(DAY_CACHE, date, next, 60);
      if (request === latestRequest.current) {
        setRecord(next.record);
        setOffDay(next.offDay);
      }
    } catch {
      if (request === latestRequest.current && !saved) setFailed(true);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [date, token]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => onReconnect(() => void load()), [load]);

  return { failed, kind, loading, offDay, record, reload: load };
}
