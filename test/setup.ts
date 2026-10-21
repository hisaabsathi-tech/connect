/**
 * Preloaded before every test file: the phone's native modules replaced with in-memory fakes,
 * and one fake API server the tests switch online, offline, slow or behind a Wi-Fi sign-in page.
 */
import { mock } from "bun:test";

process.env.EXPO_PUBLIC_API_URL = "http://api.test";

// --- File system (expo-file-system) -------------------------------------------------------
const files = new Map<string, string>();
const folders = new Set<string>();
const join = (parts: unknown[]) =>
  parts.map((part) => (typeof part === "string" ? part : (part as { uri: string }).uri)).join("/");

class FakeDirectory {
  readonly uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get exists() {
    return folders.has(this.uri) || [...files.keys()].some((key) => key.startsWith(`${this.uri}/`));
  }
  create() {
    folders.add(this.uri);
  }
  delete() {
    folders.delete(this.uri);
    for (const key of [...files.keys()]) if (key.startsWith(`${this.uri}/`)) files.delete(key);
  }
}

class FakeFile {
  readonly uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get exists() {
    return files.has(this.uri);
  }
  create() {
    if (!files.has(this.uri)) files.set(this.uri, "");
  }
  textSync() {
    const text = files.get(this.uri);
    if (text === undefined) throw new Error(`missing ${this.uri}`);
    return text;
  }
  write(text: string) {
    files.set(this.uri, text);
  }
  delete() {
    files.delete(this.uri);
  }
  copySync(destination: FakeFile) {
    files.set(destination.uri, files.get(this.uri) ?? "photo-bytes");
  }
}

mock.module("expo-file-system", () => ({
  Directory: FakeDirectory,
  File: FakeFile,
  Paths: { cache: new FakeDirectory("cache"), document: new FakeDirectory("doc") },
}));

// --- Secure store ----------------------------------------------------------------------------
const secure = new Map<string, string>();
mock.module("expo-secure-store", () => ({
  deleteItemAsync: async (key: string) => void secure.delete(key),
  getItemAsync: async (key: string) => secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void secure.set(key, value),
}));

// --- Network state and app state ---------------------------------------------------------------
type NetworkListener = (state: { isConnected?: boolean; isInternetReachable?: boolean }) => void;
const networkListeners: NetworkListener[] = [];
let networkState = { isConnected: true, isInternetReachable: true };
mock.module("expo-network", () => ({
  addNetworkStateListener: (listener: NetworkListener) => {
    networkListeners.push((state) => {
      if (state.isConnected !== undefined) networkState.isConnected = state.isConnected;
      if (state.isInternetReachable !== undefined)
        networkState.isInternetReachable = state.isInternetReachable;
      listener(state);
    });
    return { remove() {} };
  },
  getNetworkStateAsync: async () => ({ ...networkState }),
}));

type AppListener = (state: string) => void;
const appListeners: AppListener[] = [];
mock.module("react-native", () => ({
  AppState: {
    addEventListener: (_event: string, listener: AppListener) => {
      appListeners.push(listener);
      return { remove() {} };
    },
    currentState: "active",
  },
  Linking: { openSettings: async () => undefined, sendIntent: async () => undefined },
  Platform: { OS: "android" },
}));

// --- The API server ------------------------------------------------------------------------------
export type Call = { method: string; path: string; body: unknown };
type Reply = { status?: number; body?: unknown; html?: string } | "hang";

const server = {
  calls: [] as Call[],
  /** Unreachable: every request fails as when the phone has no connection. */
  offline: false,
  /** Reached, but answers with an HTML page (a Wi-Fi sign-in portal). */
  portal: false,
  /** Per "METHOD /path" answers; anything else answers `{ success: true, data: {} }`. */
  routes: new Map<string, (call: Call) => Reply>(),
  reset() {
    this.calls = [];
    this.offline = false;
    this.portal = false;
    this.routes.clear();
  },
};

const pathOf = (url: string) => url.replace("http://api.test", "").replace("/api/v1", "");

globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input);
  if (url.startsWith("doc/") || url.startsWith("cache/") || url.startsWith("file:")) {
    return new Response(new Blob(["photo"]));
  }
  const method = init.method ?? "GET";
  const path = pathOf(url).split("?")[0] ?? "";
  if (server.offline) throw new TypeError("Network request failed");
  if (server.portal) {
    return new Response("<html>Sign in to Wi-Fi</html>", {
      headers: { "content-type": "text/html" },
    });
  }
  const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : null;
  const call = { body, method, path };
  server.calls.push(call);
  const route = server.routes.get(`${method} ${path}`);
  const reply = route ? route(call) : {};
  if (reply === "hang") {
    return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    });
  }
  return new Response(JSON.stringify(reply.body ?? { data: {}, success: true }), {
    status: reply.status ?? 200,
  });
}) as typeof fetch;

// Presigned uploads go straight to storage with XMLHttpRequest.
class FakeXhr {
  status = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  url = "";
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader() {}
  send() {
    setTimeout(() => {
      if (server.offline) this.onerror?.();
      else {
        server.calls.push({ body: null, method: "PUT", path: this.url });
        this.status = 200;
        this.onload?.();
      }
    }, 0);
  }
}
(globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = FakeXhr;

/** Shared with the tests. */
(globalThis as { fake?: unknown }).fake = {
  appListeners,
  files,
  networkListeners,
  networkState,
  secure,
  server,
};
