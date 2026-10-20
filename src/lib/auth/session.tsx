import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authApi } from "@/lib/api/auth";

const TOKEN_KEY = "hisaabsathi.connector.auth-token";

type AuthSession = {
  isReady: boolean;
  token: string | null;
  completeSignIn: (token: string | null | undefined) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSession | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [isReady, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!stored) return;
      try {
        const result = await authApi.getSession(stored);
        // A session without an organisation can't use the app (every API call needs one), so
        // it is dropped and sign-in asks for the organisation again.
        if (!result.data?.session?.activeOrganizationId) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          return;
        }
        const refreshed = result.token ?? stored;
        if (active) setToken(refreshed);
        if (refreshed !== stored) await SecureStore.setItemAsync(TOKEN_KEY, refreshed);
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    })().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const completeSignIn = useCallback(async (nextToken: string | null | undefined) => {
    if (!nextToken) throw new Error("The server did not return an authentication token.");
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    setToken(nextToken);
  }, []);

  const signOut = useCallback(async () => {
    if (token) {
      try {
        await authApi.signOut(token);
      } catch {
        // Removing the local session is still the safest outcome.
      }
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
  }, [token]);

  const value = useMemo(
    () => ({ isReady, token, completeSignIn, signOut }),
    [completeSignIn, isReady, signOut, token],
  );
  return <AuthSessionContext value={value}>{children}</AuthSessionContext>;
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error("useAuthSession must be used within AuthSessionProvider");
  return value;
}
