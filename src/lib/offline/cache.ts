import { Directory, File, Paths } from "expo-file-system";

/** A saved answer and when it was saved (epoch ms). */
export type CacheEntry<T> = { data: T; savedAt: number };

type Namespace = Record<string, CacheEntry<unknown>>;

const clearedListeners = new Set<() => void>();

/** Stores that keep their own copy in memory forget it here when the cache is cleared. */
export function onCacheCleared(listener: () => void) {
  clearedListeners.add(listener);
}

// One JSON file per kind of data, so a busy one (orders) never rewrites the others.
const loaded = new Map<string, Namespace>();
let folder: Directory | null = null;

function cacheFolder() {
  folder ??= new Directory(Paths.document, "offline");
  return folder;
}

function fileOf(namespace: string) {
  return new File(cacheFolder(), `${namespace}.json`);
}

function load(namespace: string): Namespace {
  const held = loaded.get(namespace);
  if (held) return held;
  let entries: Namespace = {};
  try {
    const file = fileOf(namespace);
    if (file.exists) entries = JSON.parse(file.textSync()) as Namespace;
  } catch {
    // Unreadable: start empty; the next save replaces it.
  }
  loaded.set(namespace, entries);
  return entries;
}

/**
 * The last answer saved for `key`, kept on the phone across restarts, so a screen opens with it
 * offline (and at once online, while a fresh one loads).
 */
export function readCache<T>(namespace: string, key: string): CacheEntry<T> | null {
  return (load(namespace)[key] as CacheEntry<T> | undefined) ?? null;
}

/**
 * Saves an answer for `key`. Each kind keeps at most `limit` keys, dropping the oldest saved.
 * A failed write keeps it in memory for this run.
 */
export function writeCache<T>(namespace: string, key: string, data: T, limit = 50) {
  const entries = { ...load(namespace), [key]: { data, savedAt: Date.now() } };
  const keys = Object.keys(entries);
  if (keys.length > limit) {
    keys
      .sort((a, b) => (entries[a]?.savedAt ?? 0) - (entries[b]?.savedAt ?? 0))
      .slice(0, keys.length - limit)
      .forEach((stale) => {
        delete entries[stale];
      });
  }
  loaded.set(namespace, entries);
  try {
    const target = cacheFolder();
    if (!target.exists) target.create({ intermediates: true });
    fileOf(namespace).write(JSON.stringify(entries));
  } catch {
    // Kept in memory; the next save tries the file again.
  }
}

/**
 * Forgets everything saved. On sign-out and on switching organisation, so one organisation's
 * data never shows in another.
 */
export function clearCache() {
  loaded.clear();
  for (const listener of clearedListeners) listener();
  try {
    const target = cacheFolder();
    if (target.exists) target.delete();
  } catch {
    // Nothing saved, or already gone.
  }
}
