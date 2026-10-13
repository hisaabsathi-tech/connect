# Hisaabsathi Connector

Android Expo client for Hisaab Sathi. Native projects (`android/`) are generated with Expo Continuous
Native Generation and are never edited by hand.

Every command, and why you would use it, is in [docs/commands.md](docs/commands.md).

## Local development

Requirements: Bun, JDK 21, Android SDK/platform tools, and an Android phone with USB debugging.

```bash
bun install
bun run device
```

`device` finds the SDK/JDK, lets you choose among connected phones, reverses ports 8081 and 3000,
generates/builds the Android dev client, installs it, and starts Metro. Once the dev client is
installed, `bun run start` starts Metro only. Gradle output is quiet (progress and errors only); use
`bun run device --verbose` for the full build log.

Validation:

```bash
bun run lint
bun run typecheck
bun run doctor
```

## Branding and design system

Replace `assets/logo/base/app.svg` and/or `assets/logo/splash/dark.svg`, then regenerate the native
artwork with:

```bash
bun run logo:generate
```

Shared colors and component radius scales live in `global.css`. Components use semantic utilities
such as `bg-background`, `text-foreground`, `bg-primary`, and `border-border`. To change rounding
across the whole app, edit only `--radius`; it is currently `0px` to match the Software UI. See
[docs/branding-assets.md](docs/branding-assets.md) for every logo and splash dimension.

## Releases

`version.json` holds the app version and Android version code. Releases build on this machine.

```bash
bun run release
bun run release --dry-run --bump minor
```

The release command bumps the version, prebuilds `android/`, signs with the upload keystore in
`.keys/`, and writes `hisaabsathi-connect.aab` and `hisaabsathi-connect.apk` to `releases/vX.Y.Z/`.
Upload the AAB to Play. If the build fails, `version.json` is restored.

## Signing credentials

Generate the Play upload keystore once with:

```bash
bun run credentials:generate
```

This creates `.keys/android-upload.jks` and `.keys/android-release.env`, which the release build reads
directly. Back both up in a password manager; Play rejects updates signed with a different key.

OTA updates are parked in `../OTA/` and are not part of this app.
