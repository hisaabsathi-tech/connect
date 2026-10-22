import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const windows = process.platform === "win32";
/** Windows executables carry `.exe`; an existence check for `bin/java` alone never matches there. */
export const exe = windows ? ".exe" : "";

const homebrewSdk = "/opt/homebrew/share/android-commandlinetools";
const homebrewJdk = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
// Where Android Studio puts the SDK and its bundled JDK 21 on Windows.
const windowsSdk = join(
  process.env.LOCALAPPDATA ?? join(homedir(), "AppData/Local"),
  "Android/Sdk",
);
const windowsJdk = "C:/Program Files/Android/Android Studio/jbr";

/** The Gradle wrapper; Windows runs `gradlew.bat` through cmd, which spawn can't start directly. */
export const gradlew: [string, ...string[]] = windows
  ? ["cmd.exe", "/c", "gradlew.bat"]
  : ["./gradlew"];

export function sdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    homebrewSdk,
    join(homedir(), "Library/Android/sdk"),
    windowsSdk,
  ].filter((candidate): candidate is string => Boolean(candidate));
  return (
    candidates.find((candidate) => existsSync(join(candidate, "platform-tools", `adb${exe}`))) ??
    null
  );
}

export function javaHome() {
  const candidates = [process.env.JAVA_HOME, homebrewJdk, windowsJdk].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
  return candidates.find((candidate) => existsSync(join(candidate, "bin", `java${exe}`))) ?? null;
}

/** Process env with the Android SDK and JDK 21 wired in, or throws when either is missing. */
export function androidEnv(): { sdk: string; env: NodeJS.ProcessEnv } {
  const sdk = sdkRoot();
  const java = javaHome();
  if (!(sdk && java)) {
    throw new Error(
      windows
        ? "Android SDK or Java 21 is missing. Install Android Studio, open it once to download the SDK, or set ANDROID_HOME and JAVA_HOME."
        : "Android SDK or Java 21 is missing. Install them with: brew install openjdk@21 && brew install --cask android-commandlinetools",
    );
  }
  return {
    sdk,
    env: {
      ...process.env,
      ANDROID_HOME: sdk,
      ANDROID_SDK_ROOT: sdk,
      JAVA_HOME: java,
      PATH: `${join(java, "bin")}${delimiter}${process.env.PATH ?? ""}`,
    },
  };
}
