import { useCallback, useEffect, useRef, useState } from "react";

import { fetchRoster, type Roster, type RosterRow } from "@/lib/api/attendance-roster";

import { retryOnce } from "@/lib/retry";

const PAGE_SIZE = 20;

/**
 * The organisation's roster between two days, narrowed by an employee-name search: a page of
 * rows at a time (absent and holiday rows included), plus the totals for the top cards.
 */
export function useRoster(
  token: string | null,
  { from, search, to }: { from: string; to: string; search: string },
) {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [totals, setTotals] = useState<Omit<Roster, "items"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const page = useRef(1);
  // A new search or range starts a new generation; responses from an older one are dropped.
  const generation = useRef(0);
  const busy = useRef(false);
  // Read when the list asks for more, which can happen before a render with the latest state.
  const end = useRef(false);

  const reset = useCallback(async () => {
    if (!token) return;
    const current = ++generation.current;
    busy.current = true;
    page.current = 1;
    end.current = false;
    setLoading(true);
    setFailed(false);
    setMoreFailed(false);
    // A page still on its way belongs to the old search or range; its spinner goes too.
    setLoadingMore(false);
    try {
      const { items, ...rest } = await retryOnce(() =>
        fetchRoster(token, { from, limit: PAGE_SIZE, page: 1, search, to }),
      );
      if (current !== generation.current) return;
      end.current = items.length >= rest.total;
      setRows(items);
      setTotals(rest);
    } catch {
      if (current === generation.current) {
        setRows([]);
        setFailed(true);
      }
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [from, search, to, token]);

  const done = Boolean(totals && rows.length >= totals.total);

  const nextPage = useCallback(async () => {
    if (!token || busy.current || end.current) return;
    const current = generation.current;
    busy.current = true;
    setLoadingMore(true);
    try {
      const { items, ...rest } = await retryOnce(() =>
        fetchRoster(token, { from, limit: PAGE_SIZE, page: page.current + 1, search, to }),
      );
      if (current !== generation.current) return;
      page.current += 1;
      // An empty page also ends it, even if the total said there was more.
      end.current = !items.length || page.current * PAGE_SIZE >= rest.total;
      setRows((previous) => [...previous, ...items]);
      setTotals(rest);
    } catch {
      if (current === generation.current) setMoreFailed(true);
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  }, [from, search, to, token]);

  /** The list's end was reached; after a failed page it waits for `retryMore`. */
  const loadMore = useCallback(() => {
    if (!moreFailed) void nextPage();
  }, [moreFailed, nextPage]);

  const retryMore = useCallback(() => {
    setMoreFailed(false);
    void nextPage();
  }, [nextPage]);

  useEffect(() => {
    void reset();
  }, [reset]);

  return {
    done,
    failed,
    loadMore,
    loading,
    loadingMore,
    moreFailed,
    reset,
    retryMore,
    rows,
    totals,
  };
}
