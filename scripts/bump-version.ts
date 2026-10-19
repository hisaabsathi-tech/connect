/** biome-ignore-all lint/suspicious/noConsole: prints the new version for CI */

import { bumpKinds, nextRelease, readVersion, writeVersion } from "./version";

// Used by the GitHub release workflow: `bun scripts/bump-version.ts patch` writes version.json and
// prints the new version.
const kind = process.argv[2] ?? "";
if (!bumpKinds.includes(kind as (typeof bumpKinds)[number])) {
  console.error("Usage: bun scripts/bump-version.ts patch|minor|major");
  process.exit(1);
}
const next = nextRelease(readVersion(), kind);
writeVersion(next);
console.log(next.version);
