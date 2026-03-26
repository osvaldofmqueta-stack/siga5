const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  fontfaceobserver: path.resolve(__dirname, "shims/fontfaceobserver.js"),
};

module.exports = config;
