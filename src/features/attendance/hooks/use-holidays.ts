import { useCallback, useEffect, useState } from "react";

import { fetchNonWorkingDays, type NonWorkingDay } from "@/lib/api/attendance";
import { endOfYear, startOfYear } from "@/lib/date";

import { holidaysOf } from "../lib/days";

/**
 * This year's holidays from the organisation's attendance configuration. Empty while loading, when
 * the configuration is off, or when no holidays are set, so the Holiday List button can hide.
 */
export function useHolidays(token: string | null, today: string) {
  const [holidays, setHolidays] = useState<NonWorkingDay[]>([]);
  const from = startOfYear(today);
  const to = endOfYear(today);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setHolidays(holidaysOf(await fetchNonWorkingDays(token, from, to)));
    } catch {
      // Keeps what was shown; the button simply stays hidden until a load succeeds.
    }
  }, [from, to, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { holidays, reload: load };
}
