import type { ConfigContext, ExpoConfig } from "expo/config";
import { type ConfigPlugin, withAndroidStyles, withGradleProperties } from "expo/config-plugins";

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

// Smaller release builds: R8 strips unused Java/Kotlin code, unused resources are dropped, and
// native libraries are stored compressed inside the APK.
const releaseSizeProperties: Record<string, string> = {
  "android.enableMinifyInReleaseBuilds": "true",
  "android.enableShrinkResourcesInReleaseBuilds": "true",
  "expo.useLegacyPackaging": "true",
};

const withReleaseSizeOptimizations: ConfigPlugin = (config) =>
  withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !(item.type === "property" && item.key in releaseSizeProperties),
    );
    for (const [key, value] of Object.entries(releaseSizeProperties)) {
      config.modResults.push({ type: "property", key, value });
    }
    return config;
  });

export default ({ config }: ConfigContext): ExpoConfig =>
  withReleaseSizeOptimizations(
    withTransparentAutofillHighlight({
      ...config,
      name: "Hisaabsathi Connector",
      slug: "hisaab-sathi-connect",
      version: release.version,
      orientation: "portrait",
      icon: "./assets/logo/android/app.png",
      scheme: "hisaabsathi-connect",
      userInterfaceStyle: "light",
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
      },
      plugins: [
        "expo-router",
        "expo-secure-store",
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
  );
