/** biome-ignore-all lint/suspicious/noConsole: this CLI reports install progress */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adb, ask, chooseDevice, findAdb } from "./adb";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apkDir = resolve(root, "apks/android");
const packageName = "in.hisaabsathi.connect";
const command = "bun run android:device:install";
const libPattern = /^\s*\d+\s+\S+\s+\S+\s+lib\/([^/]+)\//gm;

/** `--apk <path>`, else this version's default build, else the newest APK in apks/android/. */
function findApk(): string {
  const args = process.argv.slice(2);
  const index = args.indexOf("--apk");
  const explicit = args.find((arg) => arg.startsWith("--apk="))?.slice("--apk=".length);
  const requested = explicit ?? (index >= 0 ? args[index + 1] : undefined);
  if (requested) {
    const path = resolve(process.cwd(), requested);
    if (!existsSync(path)) throw new Error(`${requested} does not exist.`);
    return path;
  }

  const { version } = JSON.parse(readFileSync(resolve(root, "version.json"), "utf8"));
  const current = resolve(apkDir, `hisaabsathi-connect-v${version}.apk`);
  if (existsSync(current)) return current;
  const newest = (existsSync(apkDir) ? readdirSync(apkDir) : [])
    .filter((file) => file.endsWith(".apk"))
    .map((file) => resolve(apkDir, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!newest)
    throw new Error("No APK in apks/android/. Build one with: bun run android:apk:build");
  return newest;
}

function apkAbis(apk: string): string[] {
  const listing = spawnSync("unzip", ["-l", apk], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (listing.status !== 0) throw new Error(`Could not read ${relative(root, apk)}.`);
  return [...new Set([...listing.stdout.matchAll(libPattern)].map((match) => match[1]))];
}

function install(binary: string, id: string, apk: string) {
  return spawnSync(binary, ["-s", id, "install", "-r", apk], { encoding: "utf8" });
}

try {
  const apk = findApk();
  const binary = findAdb();
  const device = await chooseDevice(binary, command);
  const name = device.model ?? device.id;

  const deviceAbis = adb(binary, ["-s", device.id, "shell", "getprop", "ro.product.cpu.abilist"])
    .trim()
    .split(",");
  const abis = apkAbis(apk);
  if (abis.length > 0 && !abis.some((abi) => deviceAbis.includes(abi))) {
    throw new Error(
      `${relative(root, apk)} contains ${abis.join(", ")}, but ${name} needs one of ` +
        `${deviceAbis.join(", ")}. Build for it with: bun run android:apk:build --abi ${deviceAbis[0]}`,
    );
  }

  console.log(`Installing ${relative(root, apk)} on ${name}…`);
  let result = install(binary, device.id, apk);
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0 && output.includes("INSTALL_FAILED_UPDATE_INCOMPATIBLE")) {
    // The development client is signed with the debug key; Android refuses to replace it.
    console.log(
      `${name} has a copy of the app signed with a different key (usually the dev client).`,
    );
    const answer = await ask(
      "Uninstall it first? This deletes the app's data on the phone. [y/N] ",
    );
    if (answer.toLowerCase() !== "y") throw new Error("Install cancelled.");
    adb(binary, ["-s", device.id, "uninstall", packageName]);
    result = install(binary, device.id, apk);
  }
  if (result.status !== 0)
    throw new Error(`Install failed: ${`${result.stdout}${result.stderr}`.trim()}`);

  adb(binary, [
    "-s",
    device.id,
    "shell",
    "monkey",
    "-p",
    packageName,
    "-c",
    "android.intent.category.LAUNCHER",
    "1",
  ]);
  console.log(`Installed and opened on ${name}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
