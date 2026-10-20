import { useCallback, useEffect, useRef, useState } from "react";

import { fetchMyAttendanceRange } from "@/lib/api/attendance";

import { type AttendanceDayEntry, buildDays } from "../lib/days";
import { retryOnce } from "../lib/retry";

/** Both days included, as `YYYY-MM-DD`. */
export type DateRange = { from: string; to: string };

/** Every day of the applied date range, oldest first, for the table and its export. */
export function useAttendanceRange(token: string | null, range: DateRange | null, today: string) {
  const [days, setDays] = useState<AttendanceDayEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const latestRequest = useRef(0);
  const from = range?.from;
  // Days after today have nothing to show yet.
  const to = range ? (range.to > today ? today : range.to) : undefined;

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setDays([]);
    setFailed(false);
    if (!(token && from && to)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await retryOnce(() => fetchMyAttendanceRange(token, from, to));
      if (request === latestRequest.current) setDays(buildDays(result, from, to, today, true));
    } catch {
      if (request === latestRequest.current) setFailed(true);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [from, to, today, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { days, failed, loading, reload: load };
}
