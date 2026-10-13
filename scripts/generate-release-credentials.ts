/** biome-ignore-all lint/suspicious/noConsole: this CLI reports generated file locations */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const keyDirectory = join(root, ".keys");
const keystore = join(keyDirectory, "android-upload.jks");
const envFile = join(keyDirectory, "android-release.env");

if (existsSync(keystore) || existsSync(envFile)) {
  throw new Error("Release credentials already exist in .keys; refusing to overwrite them.");
}

const candidates = [
  process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", "keytool") : null,
  "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/keytool",
  join(homedir(), ".sdkman/candidates/java/current/bin/keytool"),
  "keytool",
].filter((candidate): candidate is string => Boolean(candidate));
const keytool = candidates.find((candidate) => {
  const result = spawnSync(candidate, ["-help"], { stdio: "ignore" });
  return result.status === 0;
});
if (!keytool) throw new Error("keytool was not found. Install JDK 21 first.");

mkdirSync(keyDirectory, { recursive: true });
const storePassword = randomBytes(24).toString("base64url");
const keyPassword = randomBytes(24).toString("base64url");
const alias = "hisaabsathi-connect";
const result = spawnSync(
  keytool,
  [
    "-genkeypair",
    "-v",
    "-keystore",
    keystore,
    "-storetype",
    "PKCS12",
    "-alias",
    alias,
    "-keyalg",
    "RSA",
    "-keysize",
    "4096",
    "-validity",
    "10000",
    "-dname",
    "CN=Hisaab Sathi Connect, O=Hisaab Sathi, C=IN",
    "-storepass",
    storePassword,
    "-keypass",
    keyPassword,
  ],
  { encoding: "utf8" },
);
if (result.status !== 0) throw new Error(result.stderr || "keytool failed.");

writeFileSync(
  envFile,
  [
    `ANDROID_KEYSTORE_PASSWORD=${storePassword}`,
    `ANDROID_KEY_ALIAS=${alias}`,
    // PKCS12 uses the store password for the private-key entry on modern JDKs.
    `ANDROID_KEY_PASSWORD=${storePassword}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.log("Generated .keys/android-upload.jks and .keys/android-release.env.");
console.log("Both files are gitignored. Back them up in a password manager.");
