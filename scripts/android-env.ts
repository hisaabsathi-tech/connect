import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const homebrewSdk = "/opt/homebrew/share/android-commandlinetools";
const homebrewJdk = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";

export function sdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    homebrewSdk,
    join(homedir(), "Library/Android/sdk"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return (
    candidates.find((candidate) => existsSync(join(candidate, "platform-tools", "adb"))) ?? null
  );
}

export function javaHome() {
  const candidates = [process.env.JAVA_HOME, homebrewJdk].filter((candidate): candidate is string =>
    Boolean(candidate),
  );
  return candidates.find((candidate) => existsSync(join(candidate, "bin", "java"))) ?? null;
}

/** Process env with the Android SDK and JDK 21 wired in, or throws when either is missing. */
export function androidEnv(): { sdk: string; env: NodeJS.ProcessEnv } {
  const sdk = sdkRoot();
  const java = javaHome();
  if (!(sdk && java)) {
    throw new Error(
      "Android SDK or Java 21 is missing. Install them with: brew install openjdk@21 && brew install --cask android-commandlinetools",
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
