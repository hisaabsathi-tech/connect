# Connector Commands

Every command for running, checking, and releasing the Connector Android app, with why you would use
it. Run all commands from the `connector/` folder.

## Quick reference

| I want to…                                     | Run                                  |
| ---------------------------------------------- | ------------------------------------ |
| Set up the project after cloning or pulling    | `bun install`                        |
| Run the app on my phone (first time or native change) | `bun run device`              |
| Run the app when the dev client is already installed | `bun run start`               |
| Add a new package                              | `bunx expo install <package>`        |
| Regenerate every Android logo asset            | `bun run logo:generate`              |
| Check code before finishing work               | `bun run lint` and `bun run typecheck` |
| Auto-fix formatting and lint issues            | `bun run fix`                        |
| Check Expo config and dependency health        | `bun run doctor`                     |
| Make a Play Store release                      | `bun run release`                    |
| Preview a release without changing anything    | `bun run release --dry-run`          |
| Create the signing key (only once, ever)       | `bun run credentials:generate`       |

## One-time machine setup

The app builds locally, so the Mac needs Bun, JDK 21, and the Android SDK.

```bash
brew install oven-sh/bun/bun
brew install openjdk@21
brew install --cask android-commandlinetools
```

**Why:** `scripts/android-env.mjs` looks for the SDK and JDK in the Homebrew locations (or in
`ANDROID_HOME` / `JAVA_HOME`, or `~/Library/Android/sdk`). If either is missing, `device` and
`release` stop with an error telling you to install them.

On the phone: open **Settings → System → Developer options**, turn on **USB debugging**, plug it in,
choose **File transfer**, and tap **Allow** on the computer prompt.

## Install dependencies

```bash
bun install
```

**Why:** Installs everything in `package.json` into `node_modules/` using `bun.lock`. Run it after
cloning, after pulling changes that touch `package.json`, or if `node_modules/` was deleted.

## Daily development

### Run on a phone: `bun run device`

```bash
bun run device
```

**Why:** This is the main command for development. It runs `scripts/device.mjs`, which:

1. Finds the Android SDK and JDK 21.
2. Lists connected phones and asks which one to use (if more than one).
3. Sets up USB tunnels for ports `8081` (Metro) and `3000` (local server), so the phone can reach
   `localhost` on this computer.
4. Generates `android/`, builds the development client, installs it on the phone, and starts Metro.

**Use it when:** it is your first run, you added or updated a package with native code, or you changed
`app.config.ts` (icons, splash, plugins, package name). These all need a new native build.

If it says no device is ready: unlock the phone, pick **File transfer**, and check that USB debugging
is on.

### Start Metro only: `bun run start`

```bash
bun run start
```

**Why:** Runs `expo start`, which only starts the JavaScript bundler. It is much faster than `device`
because it skips the Android build.

**Use it when:** the dev client is already installed on the phone and you only changed JavaScript or
TypeScript (screens, styles, logic). Open the Connector app on the phone and it loads the new code.

> USB tunnels reset when the phone is unplugged. If the app cannot reach Metro or the server after
> reconnecting, run `bun run device` again, or set them up manually:
>
> ```bash
> adb reverse tcp:8081 tcp:8081
> adb reverse tcp:3000 tcp:3000
> ```

### Build and install without the device picker: `bun run android`

```bash
bun run android
```

**Why:** Runs `expo run:android` directly. It does the same build as `device` but skips the SDK
detection, device picker, and USB tunnels. Prefer `bun run device`; use this only if your shell
already has `ANDROID_HOME` and `JAVA_HOME` set and a single phone connected.

### Regenerate the native project: `bun run prebuild`

```bash
bun run prebuild
bun run prebuild --clean      # delete android/ and generate it fresh
```

**Why:** Runs `expo prebuild`, which writes `android/` from `app.config.ts` and plugins. The
`android/` folder is generated and ignored by git; never edit it by hand. You rarely need this
directly, because `device`, `android`, and `release` all generate it for you. Use `--clean` if a
native build behaves strangely after config changes.

### Change the Android app logo: `bun run logo:generate`

Replace `assets/logo/base/app.svg`, then run:

```bash
bun run logo:generate
```

**Why:** This generates the complete Expo/Android logo set in `assets/logo/android/`: the regular
app icon, adaptive foreground and background, Android 13+ monochrome icon, and detected color
metadata. It also renders `assets/logo/splash/dark.svg` to the native-compatible
`assets/logo/splash/dark.png`. The launcher and splash artwork follow the same safe-area proportions
used by `connector-v1`.

SVG is the preferred source. If there is no `app.svg`, the command uses `app.png`; the PNG must be
square. When both exist, SVG wins. You can select the PNG explicitly with:

```bash
bun run logo:generate -- --source=app.png
```

After changing the logo, run `bun run device` or make a release so Expo regenerates the native
Android resources. A Metro-only restart cannot change an installed launcher icon or splash screen.

See [branding-assets.md](branding-assets.md) for every source, generated, and Android density size,
including aspect ratios and artwork safe-area scaling.

## Adding packages

```bash
bunx expo install <package>
bunx expo install --fix   # fix packages whose versions don't match the Expo SDK
```

**Why:** `expo install` picks the version that matches this app's Expo SDK. Plain `bun add` can
install a version that does not work with the SDK. If the package includes native code, run
`bun run device` afterwards to rebuild the dev client.

## Checking code

Run lint and typecheck before you call any task done.

| Command             | What it runs       | Why                                                                         |
| ------------------- | ------------------ | --------------------------------------------------------------------------- |
| `bun run lint`      | `biome ci .`       | Checks formatting and lint rules without changing files. Fails on problems. |
| `bun run fix`       | `biome check --write .` | Auto-fixes formatting, import order, and safe lint issues.             |
| `bun run typecheck` | `tsc --noEmit`     | Finds TypeScript errors without producing any output files.                 |
| `bun run doctor`    | `expo-doctor`      | Finds Expo config problems and packages that don't match the SDK.           |

Typical flow: `bun run fix`, then `bun run lint`, then `bun run typecheck`.

## Releasing to the Play Store

### First time only: create the signing key

```bash
bun run credentials:generate
```

**Why:** Play Store updates must always be signed with the same upload key. This creates:

- `.keys/android-upload.jks` (the keystore)
- `.keys/android-release.env` (its passwords and alias)

It refuses to run if they already exist, so it cannot overwrite your key by accident. **Back up both
files in a password manager.** If they are lost, Play will reject future updates until Google resets
the upload key. `.keys/` is ignored by git.

### Make a release: `bun run release`

```bash
bun run release                   # asks patch / minor / major
bun run release --bump patch      # 0.0.1 → 0.0.2  (bug fixes)
bun run release --bump minor      # 0.0.1 → 0.1.0  (new features)
bun run release --bump major      # 0.0.1 → 1.0.0  (big or breaking changes)
```

**Why:** Runs `scripts/release.mjs`, which:

1. Bumps `version` in `version.json` and always adds 1 to `versionCode` (Play requires a higher
   `versionCode` for every upload).
2. Regenerates `android/` with `expo prebuild --clean`.
3. Adds release signing to the generated Gradle file (`scripts/configure-android-signing.mjs`).
4. Builds with Gradle and copies the outputs to `releases/vX.Y.Z/`:
   - `hisaabsathi-connect.aab`: upload this to the Play Console.
   - `hisaabsathi-connect.apk`: install directly on a phone for testing.

If the build fails, `version.json` is restored to the old version, so you can fix the problem and run
it again.

### Preview a release: `--dry-run`

```bash
bun run release --dry-run
bun run release --dry-run --bump minor
```

**Why:** Prints the new version and every step it would run, without changing `version.json` or
building anything. Use it to check the version numbers before a real release.

### Test the release APK on a phone

```bash
adb install -r releases/vX.Y.Z/hisaabsathi-connect.apk
```

**Why:** Installs the signed release build so you can test it exactly as users will get it. `-r`
replaces the installed app. If the dev client is installed, uninstall it first
(`adb uninstall in.hisaabsathi.connect`), because the two are signed with different keys.

## Useful adb commands

```bash
adb devices -l                            # list connected phones and their state
adb reverse --list                        # show active USB tunnels
adb uninstall in.hisaabsathi.connect      # remove the app from the phone
adb logcat '*:E'                          # show only error logs from the phone
```

If `adb` is not found, it lives in the SDK at
`/opt/homebrew/share/android-commandlinetools/platform-tools/adb`.

## Files these commands depend on

| File / folder         | Used by                     | Notes                                       |
| --------------------- | --------------------------- | ------------------------------------------- |
| `app.config.ts`       | all builds                  | App name, package id, icons, splash, plugins |
| `assets/logo/base/`   | `logo:generate`              | Editable master logo (`app.svg` or `app.png`) |
| `assets/logo/android/` | all builds                  | Generated Android launcher icon assets         |
| `assets/logo/splash/` | all builds                   | Splash SVG sources and generated native PNG    |
| `version.json`        | `release`, home screen      | Updated by `release`; don't edit by hand    |
| `scripts/`            | `device`, `release`, `credentials:generate` | Build helper scripts        |
| `.keys/`              | `release`                   | Signing key. Never commit or delete         |
| `android/`            | builds                      | Generated. Safe to delete; it is rebuilt    |
| `releases/`           | `release` output            | Built AAB and APK files, ignored by git     |
