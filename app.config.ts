import type { ConfigContext, ExpoConfig } from "expo/config";

import androidLogo from "./assets/logo/android/metadata.json";
import release from "./version.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
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
});
