import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Release = { version: string; versionCode: number };
export type BumpKind = "patch" | "minor" | "major";

export const bumpKinds: BumpKind[] = ["patch", "minor", "major"];
const versionPath = resolve(dirname(fileURLToPath(import.meta.url)), "../version.json");

export function readVersion(): Release {
  return JSON.parse(readFileSync(versionPath, "utf8"));
}

export function writeVersion(release: Release): void {
  writeFileSync(versionPath, `${JSON.stringify(release, null, 2)}\n`);
}

export function bump(version: string, kind: string): string {
  const [major, minor, patch] = version.split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The next release: a bumped version and, always, a higher versionCode, as Play requires. */
export function nextRelease(current: Release, kind: string): Release {
  return { version: bump(current.version, kind), versionCode: current.versionCode + 1 };
}
