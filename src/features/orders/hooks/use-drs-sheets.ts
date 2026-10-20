import { useCallback, useEffect, useRef, useState } from "react";

import { type DrsSheet, fetchMyDrsSheets } from "@/lib/api/drs";
import { retryOnce } from "@/lib/retry";

import { istDayBounds } from "../lib/drs";

/**
 * The delivery boy's sheets issued between two days, with their orders. Both tabs of the page
 * work from this one list: the orders, counts and filters are all worked out from it.
 */
export function useDrsSheets(token: string | null, { from, to }: { from: string; to: string }) {
  const [sheets, setSheets] = useState<DrsSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // A new range starts a new generation; answers for an older one are dropped.
  const generation = useRef(0);

  /** Loads the range again; `quiet` keeps the current list on screen meanwhile. */
  const load = useCallback(
    async (quiet = false) => {
      if (!token) return;
      const current = ++generation.current;
      if (!quiet) setLoading(true);
      setFailed(false);
      try {
        const next = await retryOnce(() => fetchMyDrsSheets(token, istDayBounds(from, to)));
        if (current === generation.current) setSheets(next);
      } catch {
        if (current === generation.current && !quiet) {
          setSheets([]);
          setFailed(true);
        }
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [from, to, token],
  );

  /** Puts a sheet the server just returned (after a status change or upload) in its place. */
  const replace = useCallback((sheet: DrsSheet) => {
    setSheets((previous) => previous.map((item) => (item.id === sheet.id ? sheet : item)));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { failed, load, loading, replace, sheets };
}
