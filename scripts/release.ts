/** biome-ignore-all lint/suspicious/noConsole: this CLI reports release progress */

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { androidEnv } from "./android-env";
import { acquireBuildLock } from "./build-lock";
import { assertApiReachable, productionEnv, signingEnv } from "./release-env";
import { bump, bumpKinds, nextRelease, readVersion, writeVersion } from "./version";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

async function buildStore(version: string): Promise<void> {
  const { env } = androidEnv();
  const production = productionEnv();
  if (!dryRun) {
    acquireBuildLock();
    await assertApiReachable(production.apiUrl);
  }
  const buildEnv = { ...env, ...signingEnv(), ...production.env };
  run(expo, ["prebuild", "--platform", "android", "--no-install", "--clean"], { env: buildEnv });
  run("bun", ["scripts/configure-android-signing.ts"], { env: buildEnv });
  // A warm Gradle daemon makes repeat local builds faster; CI runners are thrown away after one build.
  run(
    "./gradlew",
    ["bundleRelease", "assembleRelease", ...(process.env.CI ? ["--no-daemon"] : [])],
    {
      cwd: resolve(root, "android"),
      env: buildEnv,
    },
  );
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
  const current = readVersion();
  const bumpKind =
    option("--bump") ??
    (await select(
      "Version bump",
      bumpKinds.map((value) => ({
        value,
        label: `${value}: ${current.version} → ${bump(current.version, value)}`,
      })),
      0,
    ));
  if (!bumpKinds.includes(bumpKind as (typeof bumpKinds)[number]))
    throw new Error("--bump must be patch, minor, or major.");

  const next = nextRelease(current, bumpKind);
  console.log(`\nRelease v${next.version}`);
  console.log(`versionCode ${current.versionCode} → ${next.versionCode}`);
  if (dryRun) {
    console.log(`[dry-run] write ${JSON.stringify(next)}`);
  } else {
    writeVersion(next);
  }

  try {
    await buildStore(next.version);
  } catch (error) {
    if (!dryRun) writeVersion(current);
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
