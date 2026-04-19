import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { API_BASE, getToken } from "./api";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) return null;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "DriveBid",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#06b6d4",
      });
    }

    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } })?.eas
        ?.projectId;
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Send to backend
    try {
      const authToken = await getToken();
      if (authToken) {
        await fetch(`${API_BASE}/auth/push-token`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, platform: "expo" }),
        });
      }
    } catch {
      /* ignore */
    }

    return token;
  } catch {
    return null;
  }
}
