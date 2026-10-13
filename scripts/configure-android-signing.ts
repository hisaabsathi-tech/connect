/** biome-ignore-all lint/suspicious/noConsole: build helper reports its result */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gradlePath = resolve(root, "android/app/build.gradle");
const source = readFileSync(gradlePath, "utf8");
const debugBlock = /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\n\s*\})/;
if (!debugBlock.test(source))
  throw new Error("Could not find Android debug signing configuration.");

const releaseConfig = `
        release {
            def keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (keystorePath) {
                storeFile file(keystorePath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }`;

let next = source.replace(debugBlock, `$1${releaseConfig}`);
const buildTypesAt = next.indexOf("buildTypes {");
if (buildTypesAt < 0) throw new Error("Could not find Android build types.");
const beforeBuildTypes = next.slice(0, buildTypesAt);
const buildTypes = next
  .slice(buildTypesAt)
  .replace(
    /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    "$1signingConfig signingConfigs.release",
  );
next = beforeBuildTypes + buildTypes;
if (next === source || !next.includes("signingConfigs.release")) {
  throw new Error("Could not configure Android release signing.");
}
writeFileSync(gradlePath, next);
console.log("Configured generated Android project for the release upload keystore.");
