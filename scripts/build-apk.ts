/** biome-ignore-all lint/suspicious/noConsole: this CLI reports build progress */

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { androidEnv } from "./android-env";
import { productionEnv, signingEnv } from "./release-env";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expo = resolve(root, "node_modules/.bin/expo");
// Every real Android phone is ARM; 32-bit armeabi-v7a still covers budget phones. x86 is only for
// emulators: pass `--abi armeabi-v7a,arm64-v8a,x86,x86_64` to include it, or `--abi arm64-v8a`
// for the smallest APK that runs on 64-bit phones only.
const defaultAbis = "armeabi-v7a,arm64-v8a";
const abiIndex = process.argv.indexOf("--abi");
const abiArg = process.argv.find((arg) => arg.startsWith("--abi="))?.slice("--abi=".length);
const abis = abiArg ?? (abiIndex >= 0 ? process.argv[abiIndex + 1] : undefined) ?? defaultAbis;

function run(command: string, args: string[], env: NodeJS.ProcessEnv, cwd = root): void {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${[command, ...args].join(" ")} failed`);
}

try {
  const { version } = JSON.parse(readFileSync(resolve(root, "version.json"), "utf8"));
  const production = productionEnv();
  const { env } = androidEnv();
  const buildEnv = { ...env, ...signingEnv(), ...production.env };

  console.log(`Building production APK v${version} (${abis}) for ${production.apiUrl}`);
  if (production.empty.length > 0) {
    console.warn(`Warning: empty in .env.production: ${production.empty.join(", ")}`);
  }

  run(expo, ["prebuild", "--platform", "android", "--no-install", "--clean"], buildEnv);
  run("bun", ["scripts/configure-android-signing.ts"], buildEnv);
  run(
    "./gradlew",
    ["assembleRelease", "--no-daemon", `-PreactNativeArchitectures=${abis}`],
    buildEnv,
    resolve(root, "android"),
  );

  const outDir = resolve(root, "apks/android");
  const suffix = abis === defaultAbis ? "" : `-${abis.replaceAll(",", "-")}`;
  const apk = resolve(outDir, `hisaabsathi-connect-v${version}${suffix}.apk`);
  mkdirSync(outDir, { recursive: true });
  copyFileSync(resolve(root, "android/app/build/outputs/apk/release/app-release.apk"), apk);

  const size = (statSync(apk).size / 1024 / 1024).toFixed(1);
  console.log(`\nProduction APK ready (${size} MB): ${relative(root, apk)}`);
  console.log(`Install over USB: adb install -r ${relative(root, apk)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
