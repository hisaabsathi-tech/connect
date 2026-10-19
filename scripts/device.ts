/** biome-ignore-all lint/suspicious/noConsole: this CLI reports setup progress */

import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adb, chooseDevice, findAdb } from "./adb";
import { androidEnv } from "./android-env";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Gradle task lines and third-party deprecation warnings drown out progress; errors still print.
const verbose = process.argv.includes("--verbose");

try {
  const { env } = androidEnv();
  const adbBinary = findAdb();
  const device = await chooseDevice(adbBinary, "bun run device");
  for (const port of [8081, 3000]) {
    adb(adbBinary, ["-s", device.id, "reverse", `tcp:${port}`, `tcp:${port}`]);
    console.log(`USB tunnel: phone localhost:${port} → this computer`);
  }

  const child = spawn(
    join(root, "node_modules/.bin/expo"),
    ["run:android", "--device", device.model ?? device.id],
    {
      cwd: root,
      env: {
        ...env,
        // Metro workers trip Node's module.register() deprecation (DEP0205) once per worker.
        NODE_OPTIONS: [env.NODE_OPTIONS, "--disable-warning=DEP0205"].filter(Boolean).join(" "),
        ...(verbose
          ? {}
          : {
              GRADLE_OPTS: [env.GRADLE_OPTS, "-Dorg.gradle.logging.level=quiet"]
                .filter(Boolean)
                .join(" "),
            }),
      },
      stdio: "inherit",
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
