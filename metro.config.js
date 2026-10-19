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

module.exports = withNativewind(config);
