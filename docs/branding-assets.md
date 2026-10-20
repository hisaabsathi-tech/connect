# Connector Android Logo and Splash Sizes

This document records the dimensions, aspect ratios, and scaling used by the Connector branding
pipeline. Run commands from the `connect/` directory.

## Editable source files

These are the files a designer should replace. Keep their current aspect ratios.

| File | Purpose | Width | Height | Aspect ratio |
| --- | --- | ---: | ---: | ---: |
| `assets/logo/base/app.svg` | Master app/launcher icon | 307 | 307 | 1:1 |
| `assets/logo/base/app.png` | Optional PNG master icon fallback | Square | Square | 1:1 |
| `assets/logo/splash/dark.svg` | Wordmark for the default whitish splash background | 669 | 144 | 223:48 (about 4.646:1) |

SVG dimensions come from each file's `viewBox`. If `app.svg` and `app.png` both exist, the generator
uses `app.svg` unless `--source=app.png` is passed explicitly. A PNG app source must be square; use at
least 1024×1024 for best results.

## Generated project assets

Run:

```bash
bun run logo:generate
```

The command writes these build inputs:

| File | Purpose | Width | Height | Aspect ratio |
| --- | --- | ---: | ---: | ---: |
| `assets/logo/android/app.png` | Regular and legacy launcher icon | 1024 px | 1024 px | 1:1 |
| `assets/logo/android/adaptive-background.png` | Adaptive-icon background layer | 1024 px | 1024 px | 1:1 |
| `assets/logo/android/adaptive-foreground.png` | Adaptive-icon foreground layer | 1024 px | 1024 px | 1:1 |
| `assets/logo/android/adaptive-monochrome.png` | Android 13+ themed-icon layer | 1024 px | 1024 px | 1:1 |
| `assets/logo/splash/dark.png` | Native splash build input | 1024 px | 1024 px | 1:1 |

All generated PNG canvases are square because Android launcher and modern native splash resources
are built from square inputs. The wide wordmark remains wide inside the square splash canvas.

## In-app images are WebP

Images the app `require`s from `src/` are WebP, rendered at 3× their on-screen size (the largest
phone density) so one file stays sharp everywhere. SVG is kept only for the masters above, which
`logo:generate` reads and which never ship in the bundle.

`assets/logo/splash/dark.webp` (the wordmark in the auth header) is not written by
`logo:generate`. After replacing `dark.svg`, re-export it at 474 px wide (3× its 158 pt display
width) with any SVG renderer, then encode it losslessly:

```bash
cwebp -lossless -z 9 -exact dark.png -o assets/logo/splash/dark.webp
```

Encode flat vector art (icons, pins, logos) with `-lossless`; encode photographic or 3D
illustrations with `-q 90 -alpha_q 100 -m 6 -sharp_yuv`, which is about 4× smaller.

## Artwork placement inside generated files

| Asset | Artwork width | Artwork height | Outer padding |
| --- | ---: | ---: | --- |
| Launcher and adaptive layers | 819 px (80% of 1024) | 819 px | About 102–103 px per side |
| Splash wordmark | 655 px (64% of 1024) | About 141 px | Centered in the 1024×1024 canvas |

The splash canvas background is `#F9FBFF`. Its source is `assets/logo/splash/dark.svg`. The native
splash configuration displays the 1024×1024 PNG at an `imageWidth` of `288` with `contain` scaling.
The wordmark therefore occupies approximately 184 units of that displayed width. This is close to
the largest safe Android 12 splash artwork size while retaining enough room to avoid circular mask
clipping around the wide wordmark.

These percentages intentionally keep important artwork inside Android's launcher masks and native
splash clipping area. Change them only in `scripts/generate-android-logo.mjs` after testing multiple
Android launcher shapes and a release-build splash screen.

## Android density outputs

Expo prebuild converts the 1024×1024 project assets into density-specific files under
`android/app/src/main/res/`. The `android/` directory is generated and must not be edited manually.

### Regular and round launcher icons

| Android density | `ic_launcher` size | `ic_launcher_round` size | Aspect ratio |
| --- | ---: | ---: | ---: |
| mdpi | 48×48 px | 48×48 px | 1:1 |
| hdpi | 72×72 px | 72×72 px | 1:1 |
| xhdpi | 96×96 px | 96×96 px | 1:1 |
| xxhdpi | 144×144 px | 144×144 px | 1:1 |
| xxxhdpi | 192×192 px | 192×192 px | 1:1 |

### Adaptive icon layers

The background, foreground, and monochrome layers use the same dimensions at each density.

| Android density | Background | Foreground | Monochrome | Aspect ratio |
| --- | ---: | ---: | ---: | ---: |
| mdpi | 108×108 px | 108×108 px | 108×108 px | 1:1 |
| hdpi | 162×162 px | 162×162 px | 162×162 px | 1:1 |
| xhdpi | 216×216 px | 216×216 px | 216×216 px | 1:1 |
| xxhdpi | 324×324 px | 324×324 px | 324×324 px | 1:1 |
| xxxhdpi | 432×432 px | 432×432 px | 432×432 px | 1:1 |

### Native splash resources

| Android density | Generated `splashscreen_logo` size | Aspect ratio |
| --- | ---: | ---: |
| mdpi | 288×288 px | 1:1 |
| hdpi | 432×432 px | 1:1 |
| xhdpi | 576×576 px | 1:1 |
| xxhdpi | 864×864 px | 1:1 |
| xxxhdpi | 1152×1152 px | 1:1 |

## Files controlling the sizes

| Setting | Location | Current value |
| --- | --- | ---: |
| Generated canvas | `scripts/generate-android-logo.mjs` → `outputSize` | 1024 px |
| Launcher artwork scale | `scripts/generate-android-logo.mjs` → `artworkScale` | 0.8 / 80% |
| Splash wordmark scale | `scripts/generate-android-logo.mjs` → `splashArtworkScale` | 0.64 / 64% |
| Splash display width | `app.config.ts` → `imageWidth` | 288 |
| Splash resize mode | `app.config.ts` → `resizeMode` | `contain` |

After changing a source or size setting, run `bun run logo:generate`, then `bun run device` or make a
release so Expo rebuilds the native Android resources.

## Startup display sequence

The native Android splash displays `assets/logo/splash/dark.png` once while the operating system
starts the app. After React mounts, the native splash hands off to an animated `Loader` overlay. The
index screen removes that overlay after its root view completes its first layout. The React loading
layer never repeats the splash wordmark.

Do not judge the final splash sequence using Expo Go or a development build. The Expo development
client has its own splash behavior and can make startup appear to contain an additional splash.
Use a preview or production build to verify the real application sequence.
