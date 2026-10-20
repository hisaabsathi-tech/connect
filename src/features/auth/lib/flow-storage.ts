import * as SecureStore from "expo-secure-store";

import type { AuthStep } from "./types";

const FLOW_KEY = "hisaabsathi.connector.auth-flow";

/**
 * The part of a half-finished sign-in that survives the app being closed or killed. Passwords
 * are never kept; codes and pending tokens are short-lived and stay in secure storage.
 */
export type SavedAuthFlow = {
  step: AuthStep;
  email: string;
  code: string;
  trustDevice: boolean;
  challengeToken: string | null;
  orgToken: string | null;
  organizationId: string | null;
};

export async function loadAuthFlow(): Promise<SavedAuthFlow | null> {
  try {
    const raw = await SecureStore.getItemAsync(FLOW_KEY);
    return raw ? (JSON.parse(raw) as SavedAuthFlow) : null;
  } catch {
    return null;
  }
}

export function saveAuthFlow(flow: SavedAuthFlow) {
  return SecureStore.setItemAsync(FLOW_KEY, JSON.stringify(flow)).catch(() => undefined);
}

export function clearAuthFlow() {
  return SecureStore.deleteItemAsync(FLOW_KEY).catch(() => undefined);
}

/** Opens sign-in at the first step with this email filled in, e.g. after a password change. */
export function rememberSignInEmail(email: string) {
  return saveAuthFlow({
    challengeToken: null,
    code: "",
    email,
    orgToken: null,
    organizationId: null,
    step: "sign-in",
    trustDevice: false,
  });
}
