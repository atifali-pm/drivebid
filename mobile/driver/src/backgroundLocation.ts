import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./api";

export const BG_LOCATION_TASK = "drivebid-bg-location";
const ACTIVE_RIDE_KEY = "drivebid_active_ride_id";

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as { locations?: Location.LocationObject[] })?.locations;
  if (!locs || locs.length === 0) return;
  const last = locs[locs.length - 1];

  const [rideId, token] = await Promise.all([
    AsyncStorage.getItem(ACTIVE_RIDE_KEY),
    AsyncStorage.getItem("drivebid_token"),
  ]);
  if (!rideId || !token) return;

  try {
    await fetch(
      `${API_BASE}/rides/${rideId}/driver-location?lat=${last.coords.latitude}&lng=${last.coords.longitude}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch {
    /* ignore — will retry on next tick */
  }
});

export async function startBackgroundLocation(rideId: number) {
  await AsyncStorage.setItem(ACTIVE_RIDE_KEY, String(rideId));

  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return false;

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) {
    // Fall back to foreground-only; background won't work
    return false;
  }

  const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 3000,
    distanceInterval: 5,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "DriveBid trip in progress",
      notificationBody: "Sharing your location with the rider",
      notificationColor: "#10b981",
    },
  });
  return true;
}

export async function stopBackgroundLocation() {
  await AsyncStorage.removeItem(ACTIVE_RIDE_KEY);
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  }
}
