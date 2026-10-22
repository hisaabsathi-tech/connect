import { probe, reportReachable, reportUnreachable } from "@/lib/network/connectivity";

const OFFLINE_MESSAGE = "You're offline. Check your internet connection and try again.";
const SLOW_MESSAGE = "The server took too long to answer. Please try again.";

// Reads give up sooner than writes, which may carry more and matter more.
export const READ_TIMEOUT_MS = 15_000;
export const WRITE_TIMEOUT_MS = 30_000;

/** The server couldn't be reached: no network, a timeout, or a page that isn't the API's. */
export class NetworkError extends Error {
  constructor(message = OFFLINE_MESSAGE) {
    super(message);
    this.name = "NetworkError";
  }
}

/** Whether an error only means the app is offline (the request may succeed later). */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  // Auth requests report it as an AuthApiError with status 0.
  return (
    error instanceof Error &&
    error.name === "AuthApiError" &&
    (error as { status?: unknown }).status === 0
  );
}

/**
 * `fetch` with a timeout that tells the connectivity store whether the server answered. Throws
 * `NetworkError` when it didn't.
 */
export async function timedFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = READ_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    reportReachable();
    return response;
  } catch {
    // Too slow is not offline: the server may be busy with a long request (a label being read),
    // so it is asked directly before the app says it is offline.
    if (controller.signal.aborted) {
      void probe();
      throw new NetworkError(SLOW_MESSAGE);
    }
    reportUnreachable();
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The response body as JSON. A successful answer that isn't JSON is a Wi-Fi sign-in page or a
 * proxy, not the API, so it counts as offline.
 */
export async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text().catch(() => "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    if (response.ok) {
      reportUnreachable();
      throw new NetworkError();
    }
    return { message: raw };
  }
}
