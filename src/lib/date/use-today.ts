import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { todayIsoDate } from "./format";

const DAY_MS = 86_400_000;
// India has no DST, so the app's calendar day always starts at 00:00 UTC+5:30.
const IST_OFFSET_MS = 330 * 60_000;

function msUntilNextDay() {
  return DAY_MS - ((Date.now() + IST_OFFSET_MS) % DAY_MS) + 1000;
}

/** Today's `YYYY-MM-DD` in India time; updates at midnight and whenever the app returns. */
export function useTodayIsoDate() {
  const [today, setToday] = useState(todayIsoDate);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      setToday(todayIsoDate());
      clearTimeout(timer);
      timer = setTimeout(sync, msUntilNextDay());
    };
    timer = setTimeout(sync, msUntilNextDay());
    // Timers don't fire while the app is backgrounded, so re-check on return.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
