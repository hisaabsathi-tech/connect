import { useCallback, useEffect, useRef, useState } from "react";

import { fetchMyAttendanceRange } from "@/lib/api/attendance";
import { addDays, daysBetween } from "@/lib/date";

import { type AttendanceDayEntry, buildDays } from "../lib/days";
import { retryOnce } from "../lib/retry";

// The list opens on the last 7 days; scrolling down adds a month at a time.
const FIRST_PAGE_DAYS = 7;
const PAGE_DAYS = 30;
// Never reaches further back than this.
const MAX_DAYS_BACK = 366;

/**
 * Every day from today backwards, newest first (the screen shows the attended ones): the last 7
 * days, then a month more each time the list's end is reached. It stops after a month without any
 * attendance (the member had not started yet, or it is long past) or a year back.
 */
export function useAttendanceDays(token: string | null, today: string) {
  const [days, setDays] = useState<AttendanceDayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [done, setDone] = useState(false);
  // A reset starts a new generation; responses from an older one are dropped.
  const generation = useRef(0);
  const busy = useRef(false);
  const firstFrom = addDays(today, -(FIRST_PAGE_DAYS - 1));

  /** Back to the last week only, e.g. on pull to refresh or a new day. */
  const reset = useCallback(async () => {
    if (!token) return;
    const current = ++generation.current;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    setMoreFailed(false);
    setDone(false);
    // A page still on its way belongs to the old list; its spinner goes too.
    setLoadingMore(false);
    try {
      const range = await retryOnce(() => fetchMyAttendanceRange(token, firstFrom, today));
      if (current === generation.current) setDays(buildDays(range, firstFrom, today, today));
    } catch {
      if (current === generation.current) {
        setDays([]);
        setFailed(true);
      }
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [firstFrom, today, token]);

  /** Fetches the month before the oldest day shown. */
  const nextPage = useCallback(async () => {
    const oldest = days.at(-1)?.date;
    if (!(token && oldest) || busy.current || done) return;
    const to = addDays(oldest, -1);
    if (daysBetween(to, today) >= MAX_DAYS_BACK) {
      setDone(true);
      return;
    }
    const from = addDays(to, -(PAGE_DAYS - 1));
    const current = generation.current;
    busy.current = true;
    setLoadingMore(true);
    try {
      const range = await retryOnce(() => fetchMyAttendanceRange(token, from, to));
      if (current !== generation.current) return;
      setDays((previous) => [...previous, ...buildDays(range, from, to, today)]);
      if (!range.items.length) setDone(true);
    } catch {
      if (current === generation.current) setMoreFailed(true);
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  }, [days, done, today, token]);

  /** The list's end was reached; after a failed page it waits for `retryMore`. */
  const loadMore = useCallback(() => {
    if (!moreFailed) void nextPage();
  }, [moreFailed, nextPage]);

  /** Tapped after a failed page: tries that page again. */
  const retryMore = useCallback(() => {
    setMoreFailed(false);
    void nextPage();
  }, [nextPage]);

  /**
   * Re-reads the last week in place, keeping older pages and the scroll position; for coming
   * back to the tab after checking in or out.
   */
  const refreshRecent = useCallback(async () => {
    if (!token || busy.current) return;
    const current = generation.current;
    try {
      const range = await fetchMyAttendanceRange(token, firstFrom, today);
      if (current !== generation.current) return;
      const recent = buildDays(range, firstFrom, today, today);
      setDays((previous) => [...recent, ...previous.filter((day) => day.date < firstFrom)]);
    } catch {
      // The list keeps what it showed; pull to refresh retries in full.
    }
  }, [firstFrom, today, token]);

  useEffect(() => {
    void reset();
  }, [reset]);

  // Nothing attended in what is loaded leaves no cards to scroll to the end of, so fetch the
  // month before right away.
  const attended = days.some((day) => day.record);
  useEffect(() => {
    if (days.length && !attended && !(loading || loadingMore || done || failed || moreFailed))
      void nextPage();
  }, [attended, days.length, done, failed, loading, loadingMore, moreFailed, nextPage]);

  return {
    days,
    done,
    failed,
    loadMore,
    loading,
    loadingMore,
    moreFailed,
    refreshRecent,
    reset,
    retryMore,
  };
}
