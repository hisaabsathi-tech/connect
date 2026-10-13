/** biome-ignore-all lint/suspicious/noConsole: this CLI reports setup progress */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { androidEnv } from "./android-env";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Gradle task lines and third-party deprecation warnings drown out progress; errors still print.
const verbose = process.argv.includes("--verbose");
const deviceLinePattern = /\s+/;
const usbProductNamePattern = /"USB Product Name" = "([^"]+)"/g;

type Device = { id: string; state: string; model?: string };

function findAdb(sdk: string | null): string | null {
  if (spawnSync("adb", ["version"], { encoding: "utf8" }).status === 0) return "adb";
  const candidates = [
    sdk ? join(sdk, "platform-tools", "adb") : null,
    join(homedir(), "Library/Android/sdk/platform-tools/adb"),
    "/opt/homebrew/bin/adb",
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function adb(binary: string, args: string[]): string {
  const result = spawnSync(binary, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `adb ${args.join(" ")} failed`);
  return result.stdout;
}

function devices(binary: string): Device[] {
  return adb(binary, ["devices", "-l"])
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, state, ...props] = line.split(deviceLinePattern);
      // Expo's --device matches the adb model name, not the serial.
      const model = props.find((prop) => prop.startsWith("model:"))?.slice("model:".length);
      return { id, state, model };
    });
}

function usbNames() {
  if (process.platform !== "darwin") return [];
  const result = spawnSync("ioreg", ["-p", "IOUSB", "-w0", "-l"], { encoding: "utf8" });
  return result.status === 0
    ? [...result.stdout.matchAll(usbProductNamePattern)].map((match) => match[1])
    : [];
}

function printUsbHelp() {
  const phones = usbNames();
  console.error(
    [
      phones.length > 0
        ? `${phones.join(", ")} is plugged in but is not offering USB debugging.`
        : "No Android device is ready over USB.",
      "Unlock the phone and choose File transfer in the USB notification.",
      "Open Settings → System → Developer options and enable USB debugging.",
      "Tap Allow on the computer prompt, then run: bun run device",
    ].join("\n"),
  );
}

async function chooseDevice(ready: Device[]): Promise<Device> {
  if (ready.length === 1) return ready[0];
  console.log("Connected Android devices:");
  ready.forEach((device, index) => {
    console.log(`  ${index + 1}. ${device.model ?? "Unknown"} (${device.id})`);
  });
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`Choose a device [1-${ready.length}]: `);
  prompt.close();
  const selected = Number(answer) - 1;
  if (!Number.isInteger(selected) || !ready[selected]) throw new Error("Invalid device selection.");
  return ready[selected];
}

try {
  const { sdk, env } = androidEnv();

  const adbBinary = findAdb(sdk);
  if (!adbBinary)
    throw new Error("adb was not found. Open Android Studio once to install the SDK.");

  const connected = devices(adbBinary);
  const ready = connected.filter((device) => device.state === "device");
  if (ready.length === 0) {
    if (connected.some((device) => device.state === "unauthorized")) {
      throw new Error("USB debugging is not authorized. Unlock the phone and tap Allow.");
    }
    printUsbHelp();
    process.exit(1);
  }

  const device = await chooseDevice(ready);
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
