require("dotenv").config();

export default {
  expo: {
    name: "POS Scanner",
    slug: "pos-scanner",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "posscanner",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#22c55e",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.scannervibe.app",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#22c55e",
      },
      package: "com.scannervibe.app",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-image-picker",
        {
          photosPermission:
            "POS Scanner needs access to your photos to upload and scan documents.",
          cameraPermission:
            "POS Scanner needs access to your camera to scan documents.",
        },
      ],
    ],
    extra: {
      openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      "eas": {
        "projectId": "7423f81b-534f-4096-a84c-66fd7ed28f9e"
      },
    },
  },
};
