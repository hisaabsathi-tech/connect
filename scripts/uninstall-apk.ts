/** biome-ignore-all lint/suspicious/noConsole: this CLI reports uninstall progress */

import { adb, ask, chooseDevice, findAdb } from "./adb";

// Matches this app (in.hisaabsathi.connect), Connector v1 (com.hisaabsathi.connect), and any
// variant package of either.
const connectorPackage = /hisaabsathi.*connect/i;
const command = "bun run android:device:uninstall";

try {
  const binary = findAdb();
  const device = await chooseDevice(binary, command);
  const name = device.model ?? device.id;

  // -u also lists packages uninstalled with "keep data", so their leftover data is removed too.
  const packages = adb(binary, ["-s", device.id, "shell", "pm", "list", "packages", "-u"])
    .split("\n")
    .map((line) => line.trim().replace(/^package:/, ""))
    .filter((pkg) => connectorPackage.test(pkg));

  if (packages.length === 0) {
    console.log(`No Hisaab Sathi Connector app is installed on ${name}.`);
    process.exit(0);
  }

  console.log(`Hisaab Sathi Connector apps on ${name}:`);
  for (const pkg of packages) console.log(`  ${pkg}`);
  if (!process.argv.includes("--yes")) {
    const answer = await ask("Uninstall all of them? This deletes their data on the phone. [y/N] ");
    if (answer.toLowerCase() !== "y") {
      console.log("Nothing uninstalled.");
      process.exit(0);
    }
  }

  // adb uninstall removes the app and its data for every user profile on the phone.
  for (const pkg of packages) {
    adb(binary, ["-s", device.id, "uninstall", pkg]);
    console.log(`Uninstalled ${pkg}`);
  }
  console.log(`Removed ${packages.length} app${packages.length === 1 ? "" : "s"} from ${name}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
