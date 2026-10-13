/** biome-ignore-all lint/suspicious/noConsole: this CLI reports release progress */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { androidEnv } from "./android-env";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const versionPath = resolve(root, "version.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const expo = resolve(root, "node_modules/.bin/expo");

function option(name: string): string | undefined {
  const equals = args.find((arg) => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function run(
  command: string,
  commandArgs: string[],
  { cwd = root, env = process.env }: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): void {
  const printable = [command, ...commandArgs].join(" ");
  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return;
  }
  const result = spawnSync(command, commandArgs, {
    cwd,
    env,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`${printable} failed`);
}

function signingEnv() {
  const keystore = resolve(root, ".keys/android-upload.jks");
  const envFile = resolve(root, ".keys/android-release.env");
  if (!(existsSync(keystore) && existsSync(envFile))) {
    throw new Error("Upload keystore is missing. Run `bun run credentials:generate` first.");
  }
  const values = Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  return { ...values, ANDROID_KEYSTORE_PATH: keystore };
}

function buildStore(version: string): void {
  const { env } = androidEnv();
  const buildEnv = { ...env, ...signingEnv() };
  run(expo, ["prebuild", "--platform", "android", "--no-install", "--clean"], { env: buildEnv });
  run("bun", ["scripts/configure-android-signing.ts"], { env: buildEnv });
  run("./gradlew", ["bundleRelease", "assembleRelease", "--no-daemon"], {
    cwd: resolve(root, "android"),
    env: buildEnv,
  });
  const outDir = resolve(root, "releases", `v${version}`);
  if (dryRun) {
    console.log(`[dry-run] copy AAB and APK to ${outDir}`);
    return;
  }
  mkdirSync(outDir, { recursive: true });
  const outputs = resolve(root, "android/app/build/outputs");
  copyFileSync(
    resolve(outputs, "bundle/release/app-release.aab"),
    resolve(outDir, "hisaabsathi-connect.aab"),
  );
  copyFileSync(
    resolve(outputs, "apk/release/app-release.apk"),
    resolve(outDir, "hisaabsathi-connect.apk"),
  );
  console.log(`Store build ready in ${outDir}`);
}

function bump(version: string, kind: string): string {
  const [major, minor, patch] = version.split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** One buffered line reader: readline.question drops lines that arrive before it is asked. */
let lines: AsyncIterator<string> | undefined;
let reader: Interface | undefined;

async function ask(question: string): Promise<string> {
  reader ??= createInterface({ input: process.stdin });
  lines ??= reader[Symbol.asyncIterator]();
  process.stdout.write(question);
  const { value, done } = await lines.next();
  if (!process.stdin.isTTY) process.stdout.write("\n");
  return done ? "" : value;
}

async function select<T>(
  label: string,
  choices: { value: T; label: string }[],
  defaultIndex: number,
): Promise<T> {
  console.log(`\n${label}`);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.label}${index === defaultIndex ? " (recommended)" : ""}`);
  });
  const answer = await ask(`Choose [${defaultIndex + 1}]: `);
  if (!answer.trim()) return choices[defaultIndex].value;
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || !choices[index]) throw new Error("Invalid selection.");
  return choices[index].value;
}

async function main() {
  const current = JSON.parse(readFileSync(versionPath, "utf8"));
  const bumpKind =
    option("--bump") ??
    (await select(
      "Version bump",
      ["patch", "minor", "major"].map((value) => ({
        value,
        label: `${value}: ${current.version} → ${bump(current.version, value)}`,
      })),
      0,
    ));
  if (!["patch", "minor", "major"].includes(bumpKind))
    throw new Error("--bump must be patch, minor, or major.");

  const next = { version: bump(current.version, bumpKind), versionCode: current.versionCode + 1 };
  console.log(`\nRelease v${next.version}`);
  console.log(`versionCode ${current.versionCode} → ${next.versionCode}`);
  if (dryRun) {
    console.log(`[dry-run] write ${JSON.stringify(next)}`);
  } else {
    writeFileSync(versionPath, `${JSON.stringify(next, null, 2)}\n`);
  }

  try {
    buildStore(next.version);
  } catch (error) {
    if (!dryRun) writeFileSync(versionPath, `${JSON.stringify(current, null, 2)}\n`);
    console.error(`Restored version.json to ${current.version}.`);
    throw error;
  }
  console.log(`Released v${next.version}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => reader?.close());
