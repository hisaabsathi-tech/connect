import { useCallback } from "react";

import { fetchRoster, fetchWorkHours, type RosterRow } from "@/lib/api/attendance-roster";
import { eachDay } from "@/lib/date";
import type { ExportFile } from "@/lib/files/device-files";
import { useRegisterRenderer } from "../components/register-image";
import { registerLayout } from "../lib/register";
import type { DateRange } from "./use-attendance-range";

// The web register's fallback when the year's working hours can't be read.
const DEFAULT_HOURS = { workEndTime: "18:00", workStartTime: "09:00" };

/** "20-10-2026", as in the web register's file names. */
const fileStamp = (date: string) => date.split("-").reverse().join("-");

/**
 * The web app's daily attendance register as PNGs: one per day of the range (or today), every
 * employee by name with their check-in and check-out times and remarks. Render `element` once on
 * the page; `build` resolves to the files, ready to save or share.
 */
export function useRegisterDownload(token: string | null, today: string) {
  const renderer = useRegisterRenderer();
  const { render } = renderer;

  const build = useCallback(
    async (range: DateRange | null): Promise<ExportFile[]> => {
      if (!token) throw new Error("You are signed out. Please sign in again.");
      const from = range?.from ?? today;
      const to = range && range.to < today ? range.to : today;
      const days = eachDay(from, to);
      const years = [...new Set(days.map((day) => Number(day.slice(0, 4))))];
      const [hours, roster] = await Promise.all([
        Promise.all(
          years.map(async (year) => {
            const config = await fetchWorkHours(token, year).catch(() => null);
            return [
              year,
              {
                workEndTime: config?.workEndTime || DEFAULT_HOURS.workEndTime,
                workStartTime: config?.workStartTime || DEFAULT_HOURS.workStartTime,
              },
            ] as const;
          }),
        ).then((entries) => new Map(entries)),
        // Everyone, whatever the list's search shows.
        fetchRoster(token, { from, limit: 0, to }),
      ]);
      const byDate = new Map<string, RosterRow[]>();
      for (const row of roster.items) {
        const list = byDate.get(row.date) ?? [];
        list.push(row);
        byDate.set(row.date, list);
      }
      const files: ExportFile[] = [];
      // One at a time: each register is drawn by the same hidden view.
      for (const day of days) {
        const contents = await render(
          registerLayout({
            date: day,
            rows: byDate.get(day) ?? [],
            ...(hours.get(Number(day.slice(0, 4))) ?? DEFAULT_HOURS),
          }),
        );
        files.push({
          contents,
          encoding: "base64",
          mimeType: "image/png",
          name: `attendance-${fileStamp(day)}.png`,
        });
      }
      return files;
    },
    [render, today, token],
  );

  return { build, element: renderer.element };
}
