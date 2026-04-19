import { ExpoConfig, ConfigContext } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  name: "DriveBid Driver",
  slug: "drivebid-driver",
  owner: "aatifali",
  scheme: "drivebid-driver",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  updates: { enabled: false },
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.atifali.drivebid.driver",
  },
  android: {
    package: "com.atifali.drivebid.driver",
    versionCode: 5,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "INTERNET",
      "ACCESS_NETWORK_STATE",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "DriveBid Driver needs your location to share trip progress with the rider and navigate to pickup.",
      },
    ],
    [
      "expo-build-properties",
      {
        android: { usesCleartextTraffic: true },
      },
    ],
  ],
  extra: {
    router: {},
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://amusing-handcart-viewer.ngrok-free.dev",
    wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? "wss://amusing-handcart-viewer.ngrok-free.dev/ws",
    eas: {
      projectId: "5fa1ec11-5b76-4a91-9499-c7a68ea2b8a0",
    },
  },
});
