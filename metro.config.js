const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// html-to-docx requires Node built-ins (crypto, fs, util) not available in RN.
// Stub it so the bundle succeeds; DOCX export will show "not supported" on device.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "html-to-docx" && platform !== "web") {
    return {
      filePath: path.resolve(__dirname, "lib/html-to-docx-stub.ts"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
