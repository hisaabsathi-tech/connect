import { type DrsSheet, fetchMyDrsSheets } from "@/lib/api/drs";
import { retryOnce } from "@/lib/retry";

type Bounds = { from: string; to: string };
type Entry = Bounds & { scope: string; sheets: DrsSheet[] };

// The latest answers, newest last; a few ranges are plenty (Home's open sheets, Orders' days).
const MAX_ENTRIES = 12;
const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<DrsSheet[]>>();

const keyOf = (scope: string, { from, to }: Bounds) => `${scope}|${from}|${to}`;
const time = (iso: string) => Date.parse(iso);

/**
 * The member's sheets for a range, if a loaded answer already holds them: the same range, or a
 * wider one (Home loads the last month of open sheets, which covers any day the Orders tab
 * opens on). Shown at once while a fresh answer loads.
 */
export function cachedDrsSheets(scope: string, bounds: Bounds): DrsSheet[] | null {
  const exact = entries.get(keyOf(scope, bounds));
  if (exact) return exact.sheets;
  const from = time(bounds.from);
  const to = time(bounds.to);
  for (const entry of [...entries.values()].reverse()) {
    if (entry.scope !== scope || time(entry.from) > from || time(entry.to) < to) continue;
    return entry.sheets.filter((sheet) => {
      const issued = time(sheet.issuedAt);
      return issued >= from && issued <= to;
    });
  }
  return null;
}

/** Loads a range from the server; screens asking for the same range at once share one request. */
export function loadDrsSheets(scope: string, token: string, bounds: Bounds): Promise<DrsSheet[]> {
  const key = keyOf(scope, bounds);
  let request = inflight.get(key);
  if (!request) {
    request = retryOnce(() => fetchMyDrsSheets(token, bounds))
      .then((sheets) => {
        entries.delete(key);
        entries.set(key, { ...bounds, scope, sheets });
        while (entries.size > MAX_ENTRIES) {
          const oldest = entries.keys().next().value;
          if (oldest === undefined) break;
          entries.delete(oldest);
        }
        return sheets;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, request);
  }
  return request;
}

/** Puts a sheet the server just returned in place in every loaded range that holds it. */
export function replaceCachedDrsSheet(scope: string, sheet: DrsSheet) {
  for (const entry of entries.values()) {
    if (entry.scope !== scope) continue;
    entry.sheets = entry.sheets.map((item) => (item.id === sheet.id ? sheet : item));
  }
}
