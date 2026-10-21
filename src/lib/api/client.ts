import { readJson, timedFetch, WRITE_TIMEOUT_MS } from "@/lib/api/network";
import { reportRejectedToken } from "@/lib/auth/session-expiry";
import { env } from "@/lib/env";

const baseUrl = `${env.apiUrl}${env.apiPrefix}`;

export async function apiRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const reading = !init.method || init.method === "GET";
  // Throws NetworkError when the server can't be reached (offline, timeout, captive portal).
  const response = await timedFetch(
    `${baseUrl}${path}`,
    { ...init, headers },
    reading ? undefined : WRITE_TIMEOUT_MS,
  );
  const payload = await readJson(response);
  if (!response.ok) {
    if (response.status === 401) reportRejectedToken(token);
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as { message?: string }).message
        : null;
    throw new Error(message || "Something went wrong. Please try again.");
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
