import { type DrsOrderLine, type DrsSheet, fetchMyDrsSheets } from "@/lib/api/drs";
import { onCacheCleared, readCache, writeCache } from "@/lib/offline/cache";
import { retryOnce } from "@/lib/retry";

type Bounds = { from: string; to: string };
type Entry = Bounds & { scope: string; sheets: DrsSheet[]; savedAt: number };

// The latest answers, newest last; a few ranges are plenty (Home's open sheets, Orders' days).
const MAX_ENTRIES = 12;
const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<DrsSheet[]>>();

// Ranges saved on the phone by an earlier run. The saved cache is cleared on sign-out and on an
// organisation switch, so whatever is there belongs to the current session.
const SAVED_SCOPE = "saved";
const DRS_CACHE = "drs";
const saved = readCache<Entry[]>(DRS_CACHE, "entries")?.data ?? [];
for (const entry of saved) {
  entries.set(keyOf(SAVED_SCOPE, entry), { ...entry, scope: SAVED_SCOPE });
}
// Signed out or switched organisation: nothing held may show for the next one.
onCacheCleared(() => entries.clear());

function keyOf(scope: string, { from, to }: Bounds) {
  return `${scope}|${from}|${to}`;
}
const time = (iso: string) => Date.parse(iso);
const belongs = (entry: Entry, scope: string) =>
  entry.scope === scope || entry.scope === SAVED_SCOPE;

/** Keeps the ranges on the phone, so the Orders tab and Home open with them offline. */
function persist() {
  writeCache(DRS_CACHE, "entries", [...entries.values()], 1);
}

/**
 * The member's sheets for a range, if a loaded answer already holds them: the same range, or a
 * wider one (Home loads the last month of open sheets, which covers any day the Orders tab
 * opens on). Shown at once while a fresh answer loads, and kept while offline.
 */
export function cachedDrsSheets(scope: string, bounds: Bounds): DrsSheet[] | null {
  return cachedRange(scope, bounds)?.sheets ?? null;
}

/** As `cachedDrsSheets`, with when that answer was loaded (epoch ms). */
export function cachedRange(
  scope: string,
  bounds: Bounds,
): { sheets: DrsSheet[]; savedAt: number } | null {
  const exact = entries.get(keyOf(scope, bounds)) ?? entries.get(keyOf(SAVED_SCOPE, bounds));
  if (exact) return { savedAt: exact.savedAt, sheets: exact.sheets };
  const from = time(bounds.from);
  const to = time(bounds.to);
  for (const entry of [...entries.values()].reverse()) {
    if (!belongs(entry, scope) || time(entry.from) > from || time(entry.to) < to) continue;
    return {
      savedAt: entry.savedAt,
      sheets: entry.sheets.filter((sheet) => {
        const issued = time(sheet.issuedAt);
        return issued >= from && issued <= to;
      }),
    };
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
        entries.delete(keyOf(SAVED_SCOPE, bounds));
        entries.set(key, { ...bounds, savedAt: Date.now(), scope, sheets });
        while (entries.size > MAX_ENTRIES) {
          const oldest = entries.keys().next().value;
          if (oldest === undefined) break;
          entries.delete(oldest);
        }
        persist();
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
    if (!belongs(entry, scope)) continue;
    entry.sheets = entry.sheets.map((item) => (item.id === sheet.id ? sheet : item));
  }
  persist();
}

/**
 * Changes one order wherever it is held, ahead of the server (an update saved offline), so every
 * screen shows it updated. Returns the sheets of `bounds` as they now are, if held.
 */
export function patchCachedOrder(orderId: string, patch: Partial<DrsOrderLine>) {
  for (const entry of entries.values()) {
    entry.sheets = entry.sheets.map((sheet) =>
      sheet.orders.some((order) => order.orderId === orderId)
        ? {
            ...sheet,
            orders: sheet.orders.map((order) =>
              order.orderId === orderId ? { ...order, ...patch } : order,
            ),
          }
        : sheet,
    );
  }
  persist();
  for (const listener of listeners) listener();
}

const listeners = new Set<() => void>();

/** Called when an order changes locally (`patchCachedOrder`); returns the unsubscribe. */
export function onCachedOrderChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
