import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, Ride } from "../src/api";
import { formatDistance, formatDuration, formatMoney } from "../src/pricing";

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  cancelled: "#ef4444",
  in_progress: "#f59e0b",
  accepted: "#3b82f6",
  open: "#64748b",
};

export default function History() {
  const router = useRouter();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.listMyRides();
      setRides(r);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  const completedCount = rides.filter((r) => r.status === "completed").length;
  const totalSpent = rides
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => {
      const bid = r.bids.find((b) => b.id === r.accepted_bid_id);
      return sum + (bid?.amount ?? 0);
    }, 0);

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      });
    } catch { return ""; }
  }

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#06b6d4" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <Text style={styles.title}>Ride History</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{rides.length}</Text>
          <Text style={styles.statLbl}>TOTAL</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: "#10b981" }]}>{completedCount}</Text>
          <Text style={styles.statLbl}>COMPLETED</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: "#06b6d4" }]}>{formatMoney(totalSpent)}</Text>
          <Text style={styles.statLbl}>SPENT</Text>
        </View>
      </View>

      <FlatList
        data={rides}
        keyExtractor={(r) => String(r.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const bid = item.bids.find((b) => b.id === item.accepted_bid_id);
          const icon = item.ride_type === "motorcycle" ? "🏍️"
            : item.ride_type === "rickshaw" ? "🛺"
            : item.ride_type === "van" ? "🚐" : "🚗";
          return (
            <View style={styles.rideCard}>
              <View style={styles.rideHeader}>
                <Text style={styles.icon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.route}>{item.pickup} → {item.dropoff}</Text>
                  <Text style={styles.meta}>
                    {formatDate(item.created_at)}
                    {item.distance_km != null && ` · ${formatDistance(item.distance_km)}`}
                    {item.duration_min != null && ` · ${formatDuration(item.duration_min)}`}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? "#94a3b8" }]}>
                  <Text style={styles.badgeText}>{item.status.replace("_", " ")}</Text>
                </View>
              </View>
              {bid && (
                <View style={styles.ridefoot}>
                  <Text style={styles.driver}>{bid.driver_name ?? "Driver"}</Text>
                  <Text style={styles.amount}>{formatMoney(bid.amount)}</Text>
                </View>
              )}
              {item.status === "completed" && item.rider_to_driver_stars && (
                <Text style={styles.rating}>You rated {item.rider_to_driver_stars}★</Text>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No rides yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  backTxt: { fontSize: 22, color: "#1e293b" },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  statsRow: { flexDirection: "row", gap: 10, padding: 16 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  statVal: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  statLbl: { fontSize: 10, fontWeight: "700", color: "#64748b", marginTop: 2, letterSpacing: 0.5 },
  rideCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  rideHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { fontSize: 22 },
  route: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  meta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  ridefoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  driver: { fontSize: 13, color: "#475569", fontWeight: "600" },
  amount: { fontSize: 15, fontWeight: "800", color: "#06b6d4" },
  rating: { fontSize: 11, color: "#fbbf24", fontWeight: "700", marginTop: 6 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 60, fontSize: 14 },
});
