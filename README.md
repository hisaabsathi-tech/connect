# Hisaab Sathi Connect

Android Expo client for Hisaab Sathi. Native projects (`android/`) are generated with Expo Continuous
Native Generation and are never edited by hand.

Every command, and why you would use it, is in [docs/commands.md](docs/commands.md).

## Local development

Requirements: Bun, JDK 21, Android SDK/platform tools, and an Android phone with USB debugging.

```bash
bun install
bun run device
```

## Backend connection and authentication

The local `.env` is configured from the current Connector v1 values; it is intentionally ignored by Git. The Connector uses the same email/password, email OTP, password-reset, and two-factor endpoints as Software. Tokens are stored in Android/iOS secure storage, never in plain application storage.

For an Android emulator use `http://10.0.2.2:3000`; for a physical device, use the development machine's reachable LAN address. Production uses `https://api.hisaabsathi.com`. No mobile origin needs adding to `CORS_ORIGINS`: native fetch calls do not send a browser Origin.

GraphQL is ready for future protected operations through `graphqlRequest` in `src/lib/api/graphql.ts`; pass the active Connector session token. Ola Maps configuration and reverse geocoding helpers are available in `src/lib/maps/ola-maps.ts` and use the public key mirrored from Connector v1.

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

## Production APK

Put production values in `.env.production` (gitignored), then:

```bash
bun run android:apk:build              # build apks/android/hisaabsathi-connect-vX.Y.Z(-32bit).apk
bun run android:device:install   # install and open it on a USB-connected phone
```

This builds signed release APKs using only `.env.production`, one per CPU type:
`apks/android/hisaabsathi-connect-vX.Y.Z.apk` for 64-bit phones and `…-32bit.apk` for older 32-bit
ones. It does not bump the version.

GitHub can build and publish the same APK: **Actions → Android APK → Run workflow** (`rebuild`
replaces the current version's APK, `patch`/`minor`/`major` publishes a new release). Setup is in
[docs/commands.md](docs/commands.md#github-actions-build-and-release-the-apk).

## Releases

`version.json` holds the app version and Android version code. Releases build on this machine.

```bash
bun run release
bun run release --dry-run --bump minor
```

The release command bumps the version, prebuilds `android/`, signs with the upload keystore in
`.keys/`, bakes in `.env.production`, and writes `hisaabsathi-connect.aab` and `hisaabsathi-connect.apk` to `releases/vX.Y.Z/`.
Upload the AAB to Play. If the build fails, `version.json` is restored.

## Signing credentials

Generate the Play upload keystore once with:

```bash
bun run credentials:generate
```

This creates `.keys/android-upload.jks` and `.keys/android-release.env`, which the release build reads
directly. Back both up in a password manager; Play rejects updates signed with a different key.

OTA updates are parked in `../OTA/` and are not part of this app.
