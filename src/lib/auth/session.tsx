import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { useToast } from "@/components/ui/toast";
import { AuthApiError, authApi, type SessionPayload } from "@/lib/api/auth";
import { onRejectedToken } from "@/lib/auth/session-expiry";
import { TOKEN_KEY } from "@/lib/auth/token-key";
import { clearCache } from "@/lib/offline/cache";

type AuthSession = {
  isReady: boolean;
  token: string | null;
  completeSignIn: (token: string | null | undefined) => Promise<void>;
  /** Signs out on the server too, then locally. */
  signOut: () => Promise<void>;
  /**
   * Forgets the session on this phone only (the server has already ended it), which takes the
   * app back to sign in. `notice` explains why in a toast.
   */
  endSession: (notice?: { title: string; description: string }) => Promise<void>;
  /** Makes another of the user's organisations the active one, without signing in again. */
  switchOrganization: (organizationId: string) => Promise<void>;
  /**
   * Changes whenever the active organisation does. The token can stay the same across a switch,
   * so the signed-in screens are keyed on this to start over with the new organisation's data.
   */
  organizationKey: number;
};

const AuthSessionContext = createContext<AuthSession | null>(null);

/** A session the app can use: valid and inside an organisation (every API call needs one). */
function isUsable(payload: SessionPayload) {
  return Boolean(payload?.session?.activeOrganizationId);
}

/**
 * Only the server saying the session is gone ends it at launch. Offline, a timeout, a Wi-Fi
 * sign-in page or the server failing (5xx) keep it; the next request or foreground check verifies.
 */
function rejectsSession(error: unknown) {
  return error instanceof AuthApiError && (error.status === 401 || error.status === 403);
}

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const toast = useToast();
  const [isReady, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [organizationKey, setOrganizationKey] = useState(0);
  // The latest token for callbacks registered once (rejected-token handler, app-state check).
  const current = useRef<string | null>(null);
  useEffect(() => {
    current.current = token;
  }, [token]);

  const endSession = useCallback(
    async (notice?: { title: string; description: string }) => {
      current.current = null;
      setToken(null);
      clearCache();
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      if (notice) toast.show(notice);
    },
    [toast],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!stored) return;
      try {
        const result = await authApi.getSession(stored);
        // Revoked, expired, or without an organisation: sign-in starts over.
        if (!isUsable(result.data)) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          return;
        }
        const refreshed = result.token ?? stored;
        if (active) setToken(refreshed);
        if (refreshed !== stored) await SecureStore.setItemAsync(TOKEN_KEY, refreshed);
      } catch (error) {
        if (rejectsSession(error)) await SecureStore.deleteItemAsync(TOKEN_KEY);
        else if (active) setToken(stored);
      }
    })().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Any request the server rejects with this session's token (signed out elsewhere, password
  // changed, expired) ends it here, so no screen is left stuck with failing requests.
  useEffect(() => {
    onRejectedToken((rejected) => {
      if (rejected !== current.current) return;
      void endSession({
        description: "Please sign in again to continue.",
        title: "Your session has ended",
      });
    });
    return () => onRejectedToken(null);
  }, [endSession]);

  // Back in the foreground: confirm the session still exists, even if no screen asks the server.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const active = current.current;
      if (state !== "active" || !active) return;
      authApi
        .getSession(active)
        .then((result) => {
          if (current.current === active && !isUsable(result.data))
            void endSession({
              description: "Please sign in again to continue.",
              title: "Your session has ended",
            });
        })
        // A 401 is reported through the rejected-token handler; offline keeps the session.
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [endSession]);

  const completeSignIn = useCallback(async (nextToken: string | null | undefined) => {
    if (!nextToken) throw new Error("The server did not return an authentication token.");
    // A new sign-in may be someone else: nothing saved carries over.
    clearCache();
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    current.current = nextToken;
    setToken(nextToken);
  }, []);

  const switchOrganization = useCallback(async (organizationId: string) => {
    const active = current.current;
    if (!active) throw new Error("You are signed out. Please sign in again.");
    const result = await authApi.setActiveOrganization(organizationId, active);
    const nextToken = result.token ?? active;
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    // Saved screens belong to the previous organisation.
    clearCache();
    current.current = nextToken;
    setToken(nextToken);
    setOrganizationKey((key) => key + 1);
  }, []);

  const signOut = useCallback(async () => {
    const active = current.current;
    // Forget it first, so the sign-out request's own answer can't trigger "session ended".
    current.current = null;
    if (active) {
      try {
        await authApi.signOut(active);
      } catch {
        // Removing the local session is still the safest outcome.
      }
    }
    clearCache();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      completeSignIn,
      endSession,
      isReady,
      organizationKey,
      signOut,
      switchOrganization,
      token,
    }),
    [completeSignIn, endSession, isReady, organizationKey, signOut, switchOrganization, token],
  );
  return <AuthSessionContext value={value}>{children}</AuthSessionContext>;
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error("useAuthSession must be used within AuthSessionProvider");
  return value;
}
