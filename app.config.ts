import type { ConfigContext, ExpoConfig } from "expo/config";
import {
  AndroidConfig,
  type ConfigPlugin,
  withAndroidManifest,
  withAndroidStyles,
  withAppBuildGradle,
  withGradleProperties,
  withStringsXml,
} from "expo/config-plugins";

import androidLogo from "./assets/logo/android/metadata.json";
import release from "./version.json";

// Android paints a yellow "autofilled" highlight over inputs that is offset from
// the field and leaves a gap. Inputs already show their own focus state.
const withTransparentAutofillHighlight: ConfigPlugin = (config) =>
  withAndroidStyles(config, (config) => {
    const appTheme = config.modResults.resources.style?.find(
      (style) => style.$.name === "AppTheme",
    );
    if (appTheme) {
      appTheme.item = appTheme.item.filter((item) => item.$.name !== "android:autofilledHighlight");
      appTheme.item.push({
        $: { name: "android:autofilledHighlight" },
        _: "@android:color/transparent",
      });
    }
    return config;
  });

// Android 16 ignores `screenOrientation` on large screens (tablets, unfolded foldables) for apps
// targeting SDK 36, so `orientation: "portrait"` alone would let those rotate. This property opts
// out while targeting 36; Android 17 drops it, so revisit when targetSdk moves to 37.
const RESTRICTED_RESIZABILITY = "android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY";

// Expo's manifest types don't model `<property>` children of `<application>`.
type ApplicationWithProperties = AndroidConfig.Manifest.ManifestApplication & {
  property?: { $: { "android:name": string; "android:value": string } }[];
};

const withPortraitOnLargeScreens: ConfigPlugin = (config) =>
  withAndroidManifest(config, (config) => {
    const application: ApplicationWithProperties = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    const properties = (application.property ?? []).filter(
      (property) => property.$["android:name"] !== RESTRICTED_RESIZABILITY,
    );
    properties.push({ $: { "android:name": RESTRICTED_RESIZABILITY, "android:value": "true" } });
    application.property = properties;
    return config;
  });

// The home screen icon's label is just "Connect" — short enough to sit under the icon without
// wrapping or being cut off. The app's full name ("Hisaab Sathi Connect") stays everywhere else:
// Settings > Apps, the recents/app-switcher card, and the Play Store listing.
const LAUNCHER_LABEL = "Connect";

const withShortLauncherLabel: ConfigPlugin = (config) =>
  withAndroidManifest(
    withStringsXml(config, (config) => {
      config.modResults = AndroidConfig.Strings.setStringItem(
        [{ $: { name: "launcher_label", translatable: "false" }, _: LAUNCHER_LABEL }],
        config.modResults,
      );
      return config;
    }),
    (config) => {
      const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
      mainActivity.$["android:label"] = "@string/launcher_label";
      return config;
    },
  );

// Smaller release builds: R8 strips unused Java/Kotlin code, unused resources are dropped, and
// native libraries are stored compressed inside the APK. Fresco's GIF and WebP add-ons only serve
// React Native's <Image>; the app uses expo-image, and Android 7+ decodes WebP natively.
const gradleProperties: Record<string, string> = {
  "android.enableMinifyInReleaseBuilds": "true",
  "android.enableShrinkResourcesInReleaseBuilds": "true",
  "expo.useLegacyPackaging": "true",
  "expo.gif.enabled": "false",
  "expo.webp.enabled": "false",
  // Faster builds: reuse task outputs across `prebuild --clean` and CI runs, and give R8/dexing
  // enough memory not to stall on garbage collection.
  "org.gradle.caching": "true",
  "org.gradle.jvmargs": "-Xmx4096m -XX:MaxMetaspaceSize=1024m",
};

const withGradlePropertyOverrides: ConfigPlugin = (config) =>
  withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !(item.type === "property" && item.key in gradleProperties),
    );
    for (const [key, value] of Object.entries(gradleProperties)) {
      config.modResults.push({ type: "property", key, value });
    }
    return config;
  });

// Libraries ship translations for ~80 languages. The app is English-only, so keep only English
// resources; library strings (e.g. accessibility labels) then also show in English. Release lint
// ("lint vital") is skipped to save build time; `bun run lint` and typecheck still guard the code.
const releaseBuildGradle = `
android {
    androidResources {
        localeFilters += ["en"]
    }
    lint {
        checkReleaseBuilds false
    }
    // \`-PsplitApksByAbi=true\` (scripts/build-apk.ts) makes one APK per CPU type instead of one
    // carrying every type's native code; each phone only needs its own. App bundles (AAB) ignore
    // this, since Play already sends each phone only its own.
    splits {
        abi {
            enable findProperty("splitApksByAbi") == "true"
            reset()
            include(*((findProperty("reactNativeArchitectures") ?: "armeabi-v7a,arm64-v8a").toString().split(",")))
            universalApk false
        }
    }
}
`;

const withReleaseBuildGradle: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("localeFilters")) {
      config.modResults.contents += releaseBuildGradle;
    }
    return config;
  });

export default ({ config }: ConfigContext): ExpoConfig =>
  withShortLauncherLabel(
    withPortraitOnLargeScreens(
      withReleaseBuildGradle(
        withGradlePropertyOverrides(
          withTransparentAutofillHighlight({
            ...config,
            name: "Hisaab Sathi Connect",
            slug: "hisaab-sathi-connect",
            version: release.version,
            orientation: "portrait",
            icon: "./assets/logo/android/app.png",
            scheme: "hisaabsathi-connect",
            userInterfaceStyle: "light",
            // Android-only app; this just satisfies `expo prebuild`, which needs both platforms
            // identified even when only android/ is generated.
            ios: {
              bundleIdentifier: "in.hisaabsathi.connect",
            },
            android: {
              package: "in.hisaabsathi.connect",
              versionCode: release.versionCode,
              softwareKeyboardLayoutMode: "resize",
              adaptiveIcon: {
                backgroundColor: androidLogo.backgroundColor,
                foregroundImage: "./assets/logo/android/adaptive-foreground.png",
                backgroundImage: "./assets/logo/android/adaptive-background.png",
                monochromeImage: "./assets/logo/android/adaptive-monochrome.png",
              },
              predictiveBackGestureEnabled: true,
              // Attendance photos (Image Confirmation module) open the phone's camera app.
              // The live-trip location task is a persisted job (it survives a reboot), which Android
              // refuses without RECEIVE_BOOT_COMPLETED; WAKE_LOCK lets it run with the screen off.
              permissions: [
                "android.permission.CAMERA",
                "android.permission.RECEIVE_BOOT_COMPLETED",
                "android.permission.WAKE_LOCK",
                // Offline mode: knowing when the phone loses or regains its connection.
                "android.permission.ACCESS_NETWORK_STATE",
              ],
            },
            plugins: [
              "expo-router",
              // Satoshi ships only Regular and Medium. One native family maps every weight to a real
              // face (500+ → Medium), so heavier classes never fall back to a synthesized bold.
              [
                "expo-font",
                {
                  android: {
                    fonts: [
                      {
                        fontFamily: "Satoshi",
                        fontDefinitions: [
                          { path: "./assets/fonts/satoshi-regular.otf", weight: 400 },
                          { path: "./assets/fonts/satoshi-medium.otf", weight: 500 },
                          { path: "./assets/fonts/satoshi-medium.otf", weight: 600 },
                          { path: "./assets/fonts/satoshi-medium.otf", weight: 700 },
                        ],
                      },
                    ],
                  },
                  ios: {
                    fonts: [
                      "./assets/fonts/satoshi-regular.otf",
                      "./assets/fonts/satoshi-medium.otf",
                    ],
                  },
                },
              ],
              "expo-secure-store",
              // Installs MapLibre Native, which renders Ola vector tiles directly on Android/iOS.
              // A development/release build is required; this is not available in Expo Go.
              "@maplibre/maplibre-react-native",
              // Scans the parcel label's barcode before an order is updated. Video is never
              // recorded, so no microphone permission is added.
              [
                "expo-camera",
                {
                  cameraPermission:
                    "Allow Hisaab Sathi Connect to use the camera to scan parcel barcodes.",
                  recordAudioAndroid: false,
                },
              ],
              // Live delivery tracking keeps reading GPS with the app in the background, through an
              // Android foreground service (a "Live tracking on" notification) while a DRS is out.
              [
                "expo-location",
                {
                  locationWhenInUsePermission:
                    "Allow Hisaab Sathi Connect to use your location for attendance.",
                  locationAlwaysAndWhenInUsePermission:
                    "Allow Hisaab Sathi Connect to share your location while you are out for delivery, even when the app is closed.",
                  isAndroidBackgroundLocationEnabled: true,
                  isAndroidForegroundServiceEnabled: true,
                  isIosBackgroundLocationEnabled: true,
                },
              ],
              [
                "expo-splash-screen",
                {
                  backgroundColor: androidLogo.splashBackgroundColor,
                  image: "./assets/logo/splash/dark.png",
                  imageWidth: 288,
                  resizeMode: "contain",
                },
              ],
            ],
            experiments: {
              typedRoutes: true,
              reactCompiler: true,
            },
          }),
        ),
      ),
    ),
  );
