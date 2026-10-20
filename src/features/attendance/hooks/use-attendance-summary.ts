import { useCallback, useEffect, useRef, useState } from "react";

import { fetchMyAttendanceRange } from "@/lib/api/attendance";

import { type AttendanceSummary, summarize, summaryStart } from "../lib/days";

/** The top cards: days present this month out of its working days so far, and this week's hours. */
export function useAttendanceSummary(token: string | null, today: string) {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const request = ++latestRequest.current;
    try {
      const range = await fetchMyAttendanceRange(token, summaryStart(today), today);
      if (request !== latestRequest.current) return;
      setSummary(summarize(range, today));
      setFailed(false);
    } catch {
      if (request === latestRequest.current) setFailed(true);
    }
  }, [today, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { failed, reload: load, summary };
}
