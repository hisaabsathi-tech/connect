import { readJson, timedFetch, WRITE_TIMEOUT_MS } from "@/lib/api/network";
import { reportRejectedToken } from "@/lib/auth/session-expiry";
import { env } from "@/lib/env";

const baseUrl = `${env.apiUrl}${env.apiPrefix}`;

/** The server answered with an error status. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** From `Retry-After` (429 / 503), in ms. */
    readonly retryAfterMs: number | null,
  ) {
    super(message);
  }
}

function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

export async function apiRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  // A FormData body sets its own multipart Content-Type, with the boundary.
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const reading = !init.method || init.method === "GET";
  // Throws NetworkError when the server can't be reached (offline, timeout, captive portal).
  const response = await timedFetch(
    `${baseUrl}${path}`,
    { ...init, headers },
    timeoutMs ?? (reading ? undefined : WRITE_TIMEOUT_MS),
  );
  const payload = await readJson(response);
  if (!response.ok) {
    if (response.status === 401) reportRejectedToken(token);
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as { message?: string }).message
        : null;
    throw new ApiError(
      message || "Something went wrong. Please try again.",
      response.status,
      retryAfterMs(response.headers.get("Retry-After")),
    );
  }
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    (payload as { success?: unknown }).success === true &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
