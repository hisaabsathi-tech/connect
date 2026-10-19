/** biome-ignore-all lint/suspicious/noConsole: device helpers report USB problems */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { sdkRoot } from "./android-env";

const deviceLinePattern = /\s+/;
const usbProductNamePattern = /"USB Product Name" = "([^"]+)"/g;

export type Device = { id: string; state: string; model?: string };

export function findAdb(): string {
  if (spawnSync("adb", ["version"], { encoding: "utf8" }).status === 0) return "adb";
  const sdk = sdkRoot();
  const candidates = [
    sdk ? join(sdk, "platform-tools", "adb") : null,
    join(homedir(), "Library/Android/sdk/platform-tools/adb"),
    "/opt/homebrew/bin/adb",
  ].filter((candidate): candidate is string => Boolean(candidate));
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("adb was not found. Open Android Studio once to install the SDK.");
  return found;
}

export function adb(binary: string, args: string[]): string {
  const result = spawnSync(binary, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `adb ${args.join(" ")} failed`);
  return result.stdout;
}

export function devices(binary: string): Device[] {
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

function printUsbHelp(command: string) {
  const phones = usbNames();
  console.error(
    [
      phones.length > 0
        ? `${phones.join(", ")} is plugged in but is not offering USB debugging.`
        : "No Android device is ready over USB.",
      "Unlock the phone and choose File transfer in the USB notification.",
      "Open Settings → System → Developer options and enable USB debugging.",
      `Tap Allow on the computer prompt, then run: ${command}`,
    ].join("\n"),
  );
}

export async function ask(question: string): Promise<string> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(question);
  prompt.close();
  return answer.trim();
}

/** The one ready device, or the one the user picks; exits with USB help when none is ready. */
export async function chooseDevice(binary: string, command: string): Promise<Device> {
  const connected = devices(binary);
  const ready = connected.filter((device) => device.state === "device");
  if (ready.length === 0) {
    if (connected.some((device) => device.state === "unauthorized")) {
      throw new Error("USB debugging is not authorized. Unlock the phone and tap Allow.");
    }
    printUsbHelp(command);
    process.exit(1);
  }
  if (ready.length === 1) return ready[0];
  console.log("Connected Android devices:");
  ready.forEach((device, index) => {
    console.log(`  ${index + 1}. ${device.model ?? "Unknown"} (${device.id})`);
  });
  const selected = Number(await ask(`Choose a device [1-${ready.length}]: `)) - 1;
  if (!Number.isInteger(selected) || !ready[selected]) throw new Error("Invalid device selection.");
  return ready[selected];
}
