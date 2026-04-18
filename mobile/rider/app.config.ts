import { ExpoConfig, ConfigContext } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  name: "DriveBid Rider",
  slug: "drivebid",
  owner: "aatifalis-organization",
  scheme: "drivebid-rider",
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
    bundleIdentifier: "com.atifali.drivebid.rider",
  },
  android: {
    package: "com.atifali.drivebid.rider",
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
          "DriveBid uses your location to set pickup and drop-off and to track your trip.",
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
      // filled by `eas init`
    },
  },
});
