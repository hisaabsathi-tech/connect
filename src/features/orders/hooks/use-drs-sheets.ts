import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DrsSheet } from "@/lib/api/drs";
import { useAuthSession } from "@/lib/auth/session";

import { istDayBounds } from "../lib/drs";
import { cachedDrsSheets, loadDrsSheets, replaceCachedDrsSheet } from "../lib/drs-cache";

/**
 * The member's sheets issued between two days, with their orders. Both tabs of the page work
 * from this one list: the orders, counts and filters are all worked out from it. A range already
 * loaded (or inside one, such as Home's month of open sheets) shows at once and refreshes quietly.
 */
export function useDrsSheets(token: string | null, { from, to }: { from: string; to: string }) {
  const { organizationKey } = useAuthSession();
  // Answers are kept per sign-in and organisation, so a switch never shows another org's sheets.
  const scope = token ? `${organizationKey}:${token}` : null;
  const bounds = useMemo(() => istDayBounds(from, to), [from, to]);
  const [sheets, setSheets] = useState<DrsSheet[]>(
    () => (scope && cachedDrsSheets(scope, bounds)) || [],
  );
  const [loading, setLoading] = useState(() => !(scope && cachedDrsSheets(scope, bounds)));
  const [failed, setFailed] = useState(false);
  // A new range starts a new generation; answers for an older one are dropped.
  const generation = useRef(0);

  /** Loads the range again; `quiet` keeps the current list on screen meanwhile. */
  const load = useCallback(
    async (quiet = false) => {
      const current = ++generation.current;
      if (!(scope && token)) {
        setSheets([]);
        setLoading(false);
        return;
      }
      const cached = cachedDrsSheets(scope, bounds);
      if (cached) {
        setSheets(cached);
        setLoading(false);
      } else if (!quiet) {
        setLoading(true);
      }
      setFailed(false);
      try {
        const next = await loadDrsSheets(scope, token, bounds);
        if (current === generation.current) setSheets(next);
      } catch {
        if (current === generation.current && !quiet && !cached) {
          setSheets([]);
          setFailed(true);
        }
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [bounds, scope, token],
  );

  /** Puts a sheet the server just returned (after a status change or upload) in its place. */
  const replace = useCallback(
    (sheet: DrsSheet) => {
      if (scope) replaceCachedDrsSheet(scope, sheet);
      setSheets((previous) => previous.map((item) => (item.id === sheet.id ? sheet : item)));
    },
    [scope],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { failed, load, loading, replace, sheets };
}
