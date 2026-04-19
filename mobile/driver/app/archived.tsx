import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, Ride } from "../src/api";
import { formatMoney } from "../src/pricing";

export default function Archived() {
  const router = useRouter();
  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const hidden = await api.listHiddenRides();
      setRides(hidden);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRestore(ride: Ride) {
    Vibration.vibrate(35);
    setRides((prev) => prev.filter((r) => r.id !== ride.id));
    try {
      await api.unhideRide(ride.id);
    } catch {
      setRides((prev) => [...prev, ride]);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <Text style={styles.title}>Archived rides</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {rides.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No archived rides</Text>
            <Text style={styles.emptySub}>
              Rides you archive from the dashboard will appear here.
            </Text>
          </View>
        ) : (
          rides.map((ride) => (
            <View key={ride.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.route}>
                  {ride.pickup} → {ride.dropoff}
                </Text>
                <Text style={styles.meta}>
                  {ride.rider_name ?? "Rider"} · Budget{" "}
                  {formatMoney(ride.max_budget)}
                </Text>
              </View>
              <Pressable
                onPress={() => handleRestore(ride)}
                android_ripple={{ color: "rgba(16,185,129,0.2)" }}
                style={({ pressed }) => [
                  styles.restoreBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.restoreText}>Restore</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  backTxt: { fontSize: 22, color: "#1e293b" },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155", marginBottom: 4 },
  emptySub: { fontSize: 13, color: "#64748b", textAlign: "center", maxWidth: 260 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  route: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginBottom: 2 },
  meta: { fontSize: 12, color: "#64748b" },
  restoreBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#10b981",
  },
  restoreText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
