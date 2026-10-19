import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const lockPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.expo/android-build.lock");

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Release builds regenerate `android/` with `prebuild --clean`, so a second build started meanwhile
 * deletes the first one's output halfway. Holds a PID lock until this process exits.
 */
export function acquireBuildLock(): void {
  if (existsSync(lockPath)) {
    const pid = Number(readFileSync(lockPath, "utf8"));
    if (pid && pid !== process.pid && isRunning(pid)) {
      throw new Error(
        `Another Android build is running (pid ${pid}). Wait for it to finish; both use android/.`,
      );
    }
  }
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, String(process.pid));
  process.on("exit", () => {
    if (existsSync(lockPath) && Number(readFileSync(lockPath, "utf8")) === process.pid) {
      rmSync(lockPath, { force: true });
    }
  });
}
