import { reportRejectedToken } from "@/lib/auth/session-expiry";
import { env } from "@/lib/env";

export class GraphqlApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GraphqlApiError";
  }
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{
    message?: string;
    extensions?: { code?: string; http?: { status?: number } };
  }>;
}

export const graphqlUrl = `${env.apiUrl}${env.apiPrefix}${env.graphqlPath}`;

/**
 * Shared GraphQL transport for future Connector features. Pass the active bearer
 * token from `useAuthSession()` for protected operations.
 */
export async function graphqlRequest<T>(options: {
  query: string;
  token?: string | null;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  let response: Response;
  try {
    response = await fetch(graphqlUrl, {
      body: JSON.stringify({ query: options.query, variables: options.variables }),
      headers,
      method: "POST",
    });
  } catch {
    throw new GraphqlApiError(
      "Couldn't reach the server. Check your internet connection and try again.",
    );
  }

  const payload = (await response.json().catch(() => null)) as GraphqlResponse<T> | null;
  // The server reports a revoked or expired session as HTTP 401 or as a 401 GraphQL error.
  const unauthorized =
    response.status === 401 ||
    payload?.errors?.some(
      (error) =>
        error.extensions?.http?.status === 401 ||
        error.extensions?.code === "UNAUTHORIZED" ||
        error.extensions?.code === "UNAUTHENTICATED",
    );
  if (unauthorized) reportRejectedToken(options.token);
  if (!response.ok) {
    throw new GraphqlApiError(
      payload?.errors?.[0]?.message || "GraphQL request failed.",
      response.status,
    );
  }
  if (payload?.errors?.length) {
    throw new GraphqlApiError(payload.errors[0]?.message || "GraphQL request failed.");
  }
  if (!payload || !("data" in payload))
    throw new GraphqlApiError("GraphQL returned an invalid response.");
  return payload.data as T;
}
