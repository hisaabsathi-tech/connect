import * as SecureStore from "expo-secure-store";

const CHANGE_PASSWORD_KEY = "hisaabsathi.connector.profile-change-password";

export type SavedChangePassword = {
  email: string;
  /** Only stages with a sent OTP are persisted. */
  step: "code" | "password";
  code: string;
  resendEndsAt: number;
};

/** Stores a short-lived recovery attempt without ever writing a password to disk. */
export async function loadChangePassword(): Promise<SavedChangePassword | null> {
  try {
    const raw = await SecureStore.getItemAsync(CHANGE_PASSWORD_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedChangePassword>;
    if (
      typeof saved.email !== "string" ||
      (saved.step !== "code" && saved.step !== "password") ||
      typeof saved.code !== "string" ||
      typeof saved.resendEndsAt !== "number"
    )
      return null;
    return saved as SavedChangePassword;
  } catch {
    return null;
  }
}

export function saveChangePassword(attempt: SavedChangePassword) {
  return SecureStore.setItemAsync(CHANGE_PASSWORD_KEY, JSON.stringify(attempt)).catch(() => undefined);
}

export function clearChangePassword() {
  return SecureStore.deleteItemAsync(CHANGE_PASSWORD_KEY).catch(() => undefined);
}
