const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Replace fontfaceobserver with a no-op shim.
// expo-font calls FontObserver.load(null, 6000) which times out in the Replit
// proxy environment. Fonts are already loaded via @font-face CSS injected by
// the Express server, so this observer is redundant and only causes noise.
const _defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "fontfaceobserver") {
    return {
      filePath: path.resolve(__dirname, "shims/fontfaceobserver.js"),
      type: "sourceFile",
    };
  }
  if (_defaultResolveRequest) {
    return _defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
