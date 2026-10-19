import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { useTodayIsoDate } from "./use-today";

type DateFilter = {
  today: string;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  /**
   * The day the date strip should scroll to its centre. A new object per request, so asking for
   * the same day again (today after a refresh) still scrolls back to it.
   */
  centerRequest: { date: string };
  /** Selects today again, e.g. when the page is pulled to refresh. */
  resetToToday: () => void;
};
const DateFilterContext = createContext<DateFilter | null>(null);

/** Deliberately in memory: closing the app starts the next session at today. */
export function DateFilterProvider({ children }: PropsWithChildren) {
  const today = useTodayIsoDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [previousToday, setPreviousToday] = useState(today);
  const [centerRequest, setCenterRequest] = useState(() => ({ date: today }));

  // At midnight, a selection still on "today" follows it to the new day.
  if (today !== previousToday) {
    setPreviousToday(today);
    if (selectedDate === previousToday) setSelectedDate(today);
    setCenterRequest({ date: today });
  }

  const resetToToday = useCallback(() => {
    setSelectedDate(today);
    setCenterRequest({ date: today });
  }, [today]);

  const value = useMemo(
    () => ({ today, selectedDate, setSelectedDate, centerRequest, resetToToday }),
    [today, selectedDate, centerRequest, resetToToday],
  );
  return <DateFilterContext value={value}>{children}</DateFilterContext>;
}

export function useDateFilter() {
  const value = useContext(DateFilterContext);
  if (!value) throw new Error("useDateFilter must be used inside DateFilterProvider");
  return value;
}
