import { apiRequest } from "@/lib/api/client";
import { env } from "@/lib/env";

const AUTH_TOKEN_HEADER = "set-auth-token";
const tokenUrl = `${env.apiUrl}${env.authBasePath}`;
// Native apps do not send a browser Origin header. This is one of the trusted
// Connector origins configured by the API and is required by Better Auth.
const CONNECT_ORIGIN = "http://localhost";

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export type SignInResult = { token?: string; twoFactorRedirect?: boolean };

/** Better Auth's session payload; null when the token is no longer valid. */
export type SessionPayload = { session?: { activeOrganizationId?: string | null } } | null;

export type AuthOrganization = { id: string; name: string; slug: string; logo?: string | null };

function messageFrom(payload: unknown) {
  if (payload && typeof payload === "object") {
    const message = (payload as { message?: unknown; error?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return "Something went wrong. Please try again.";
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Origin", CONNECT_ORIGIN);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${tokenUrl}${path}`, { ...options, headers });
  } catch {
    throw new AuthApiError(
      "Couldn't reach the server. Check your internet connection and try again.",
      0,
    );
  }

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { message: raw };
    }
  }
  if (!response.ok) throw new AuthApiError(messageFrom(payload), response.status);

  return { data: payload as T, token: response.headers.get(AUTH_TOKEN_HEADER) };
}

export const authApi = {
  getSession: (token: string) => request<SessionPayload>("/get-session", { method: "GET" }, token),
  /** Organisations the user belongs to, with `logo` as a view URL; works before one is active. */
  listOrganizations: (token: string) =>
    apiRequest<AuthOrganization[]>("/organizations/me/memberships", token),
  setActiveOrganization: (organizationId: string, token: string) =>
    request<unknown>(
      "/organization/set-active",
      { body: JSON.stringify({ organizationId }), method: "POST" },
      token,
    ),
  signIn: (email: string, password: string) =>
    request<SignInResult>("/sign-in/email", {
      body: JSON.stringify({ email, password, rememberMe: true }),
      method: "POST",
    }),
  sendSignInCode: (email: string) =>
    request<{ success: boolean }>("/email-otp/send-verification-otp", {
      body: JSON.stringify({ email, type: "sign-in" }),
      method: "POST",
    }),
  signInWithCode: (email: string, otp: string) =>
    request<SignInResult>("/sign-in/email-otp", {
      body: JSON.stringify({ email, otp }),
      method: "POST",
    }),
  requestPasswordReset: (email: string) =>
    request<{ success: boolean }>("/email-otp/request-password-reset", {
      body: JSON.stringify({ email }),
      method: "POST",
    }),
  checkPasswordResetCode: (email: string, otp: string) =>
    request<{ success: boolean }>("/email-otp/check-verification-otp", {
      body: JSON.stringify({ email, otp, type: "forget-password" }),
      method: "POST",
    }),
  resetPassword: (email: string, otp: string, password: string) =>
    request<{ success: boolean }>("/email-otp/reset-password", {
      body: JSON.stringify({ email, otp, password }),
      method: "POST",
    }),
  verifyTotp: (code: string, trustDevice: boolean, token: string) =>
    request<SignInResult>(
      "/two-factor/verify-totp",
      { body: JSON.stringify({ code, trustDevice }), method: "POST" },
      token,
    ),
  sendTwoFactorCode: (trustDevice: boolean, token: string) =>
    request<{ success: boolean }>(
      "/two-factor/send-otp",
      { body: JSON.stringify({ trustDevice }), method: "POST" },
      token,
    ),
  verifyTwoFactorCode: (code: string, trustDevice: boolean, token: string) =>
    request<SignInResult>(
      "/two-factor/verify-otp",
      { body: JSON.stringify({ code, trustDevice }), method: "POST" },
      token,
    ),
  signOut: (token: string) =>
    request<unknown>("/sign-out", { body: JSON.stringify({}), method: "POST" }, token),
};
