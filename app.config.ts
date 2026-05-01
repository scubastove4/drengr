import type { ExpoConfig } from "expo/config";

export default (): ExpoConfig => ({
  name: "Drengr",
  slug: "drengr",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  scheme: "drengr",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0b0f14",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "dev.drengr.app",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Your position is shown on the arena map during play. Location is not stored on our servers.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0b0f14",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "dev.drengr.app",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Show your position on the arena map while the app is open.",
      },
    ],
    [
      "@rnmapbox/maps",
      {
        RNMapboxMapsVersion: "11.18.2",
      },
    ],
  ],
});
