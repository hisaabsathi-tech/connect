import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quoted = /^(["'])(.*)\1$/;
const localHost = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

function readEnvFile(path: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const value = line.slice(line.indexOf("=") + 1).trim();
        return [line.slice(0, line.indexOf("=")).trim(), value.replace(quoted, "$2")];
      }),
  );
}

/** Upload keystore location and passwords for the generated release signing config. */
export function signingEnv() {
  const keystore = resolve(root, ".keys/android-upload.jks");
  const envFile = resolve(root, ".keys/android-release.env");
  if (!(existsSync(keystore) && existsSync(envFile))) {
    throw new Error("Upload keystore is missing. Run `bun run credentials:generate` first.");
  }
  return { ...readEnvFile(envFile), ANDROID_KEYSTORE_PATH: keystore };
}

/**
 * Values from `.env.production` for release bundles. Expo's own `.env` loading is switched off so the
 * development `.env` can never fill in a key that production left out.
 */
export function productionEnv() {
  const envFile = resolve(root, ".env.production");
  if (!existsSync(envFile)) {
    throw new Error(
      "`.env.production` is missing. Create it from `.env.example` with production values.",
    );
  }
  const values = readEnvFile(envFile);

  const apiUrl = values.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("EXPO_PUBLIC_API_URL is empty in `.env.production`.");
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL in `.env.production` must be a valid absolute URL.");
  }
  if (url.protocol !== "https:" || localHost.test(url.hostname)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL in \`.env.production\` must be a public https URL, not ${apiUrl}.`,
    );
  }
  const mode = values.EXPO_PUBLIC_APPLICATION_MODE ?? "production";
  if (mode !== "production") {
    throw new Error(
      `EXPO_PUBLIC_APPLICATION_MODE in \`.env.production\` must be production, not ${mode}.`,
    );
  }

  const empty = Object.entries(values)
    .filter(([key, value]) => key.startsWith("EXPO_PUBLIC_") && !value)
    .map(([key]) => key);
  return {
    apiUrl,
    env: {
      ...values,
      EXPO_PUBLIC_APPLICATION_MODE: mode,
      EXPO_NO_DOTENV: "1",
      NODE_ENV: "production",
    },
    empty,
  };
}
