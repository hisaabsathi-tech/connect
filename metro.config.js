const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Release bundles inline EXPO_PUBLIC_ values at transform time, but Metro's cache key ignores them.
// Keying the cache on those values stops a production build reusing modules with development keys.
config.cacheVersion = Object.keys(process.env)
  .filter((key) => key.startsWith("EXPO_PUBLIC_"))
  .sort()
  .map((key) => `${key}=${process.env[key]}`)
  .join("\n");

// expo-router imports expo-symbols, which bundles the ~1 MB Material Symbols font for Android
// <SymbolView> and native-tab icons. The app uses neither, so the font resolves to an empty module.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@expo-google-fonts/material-symbols")) return { type: "empty" };
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativewind(config);
