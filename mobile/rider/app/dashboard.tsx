import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, Ride } from "../src/api";
import { useAuth } from "../src/useAuth";
import { formatDistance, formatDuration, formatMoney } from "../src/pricing";

const STATUS_COLORS: Record<string, string> = {
  open: "#10b981",
  accepted: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#64748b",
  cancelled: "#ef4444",
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRides(await api.listMyRides());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>DriveBid</Text>
          <Text style={styles.subBrand}>{user?.full_name} · Rider</Text>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.newRideBtn}
        onPress={() => setShowForm(!showForm)}
      >
        <Text style={styles.newRideText}>
          {showForm ? "Cancel" : "+ Post New Ride"}
        </Text>
      </Pressable>

      {showForm && (
        <NewRideForm
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}

      <FlatList
        data={rides}
        keyExtractor={(r) => String(r.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item }) => (
          <RideCard ride={item} onAction={refresh} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No rides yet. Post one above.</Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

function NewRideForm({ onCreated }: { onCreated: () => void }) {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!pickup || !dropoff || !budget) return;
    setLoading(true);
    try {
      await api.createRide({
        pickup,
        dropoff,
        max_budget: Number(budget),
        notes,
      });
      onCreated();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="Pickup address"
        value={pickup}
        onChangeText={setPickup}
      />
      <TextInput
        style={styles.input}
        placeholder="Dropoff address"
        value={dropoff}
        onChangeText={setDropoff}
      />
      <TextInput
        style={styles.input}
        placeholder="Max budget (Rs)"
        keyboardType="numeric"
        value={budget}
        onChangeText={setBudget}
      />
      <TextInput
        style={styles.input}
        placeholder="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
      />
      <Pressable
        style={[styles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={submit}
        disabled={loading}
      >
        <Text style={styles.submitText}>
          {loading ? "Posting..." : "Post Ride"}
        </Text>
      </Pressable>
    </View>
  );
}

function RideCard({
  ride,
  onAction,
}: {
  ride: Ride;
  onAction: () => void;
}) {
  const accepted = ride.bids.find((b) => b.id === ride.accepted_bid_id);

  async function acceptBid(bidId: number) {
    try {
      await api.acceptBid(ride.id, bidId);
      onAction();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    }
  }

  async function cancel() {
    try {
      await api.cancelRide(ride.id);
      onAction();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    }
  }

  async function rate(stars: number) {
    try {
      await api.rateRide(ride.id, stars, "");
      onAction();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardRoute}>
            {ride.pickup} → {ride.dropoff}
          </Text>
          <Text style={styles.cardMeta}>
            Budget: {formatMoney(ride.max_budget)}
            {ride.distance_km != null && ` · ${formatDistance(ride.distance_km)}`}
            {ride.duration_min != null && ` · ${formatDuration(ride.duration_min)}`}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            { backgroundColor: STATUS_COLORS[ride.status] ?? "#94a3b8" },
          ]}
        >
          <Text style={styles.badgeText}>{ride.status.replace("_", " ")}</Text>
        </View>
      </View>

      {accepted && ride.status !== "open" && (
        <View style={styles.acceptedBar}>
          <Text style={styles.acceptedText}>
            {accepted.driver_name} · {formatMoney(accepted.amount)} · ETA{" "}
            {accepted.eta_minutes}m
          </Text>
        </View>
      )}

      {ride.status === "open" && ride.bids.length > 0 && (
        <View style={styles.bids}>
          <Text style={styles.bidsLabel}>
            Bids ({ride.bids.length})
          </Text>
          {ride.bids
            .sort((a, b) => a.amount - b.amount)
            .map((bid) => (
              <View key={bid.id} style={styles.bidRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bidDriver}>
                    {bid.driver_name ?? "Driver"} — {formatMoney(bid.amount)}
                  </Text>
                  <Text style={styles.bidMeta}>
                    ETA {bid.eta_minutes}m{bid.message ? ` · ${bid.message}` : ""}
                  </Text>
                </View>
                <Pressable
                  style={styles.acceptBtn}
                  onPress={() => acceptBid(bid.id)}
                >
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </Pressable>
              </View>
            ))}
        </View>
      )}

      {ride.status === "open" && ride.bids.length === 0 && (
        <Text style={styles.waiting}>Waiting for drivers to bid...</Text>
      )}

      {ride.status === "completed" && ride.rider_to_driver_stars === null && (
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Rate driver:</Text>
          {[1, 2, 3, 4, 5].map((s) => (
            <Pressable key={s} onPress={() => rate(s)}>
              <Text style={styles.star}>★</Text>
            </Pressable>
          ))}
        </View>
      )}

      {ride.status === "completed" && ride.rider_to_driver_stars != null && (
        <Text style={styles.rated}>
          You rated {ride.rider_to_driver_stars}★
        </Text>
      )}

      {(ride.status === "open" || ride.status === "accepted") && (
        <Pressable onPress={cancel}>
          <Text style={styles.cancelLink}>Cancel ride</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 52,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  brand: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  subBrand: { fontSize: 12, color: "#64748b" },
  logoutBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: { fontSize: 13, color: "#475569" },
  newRideBtn: {
    margin: 16,
    backgroundColor: "#0ea5e9",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  newRideText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  form: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: "#0ea5e9",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40, fontSize: 15 },
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  cardRoute: { fontSize: 15, fontWeight: "600", color: "#1e293b", marginBottom: 2 },
  cardMeta: { fontSize: 12, color: "#64748b" },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  acceptedBar: {
    marginTop: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  acceptedText: { fontSize: 13, color: "#1e3a5f" },
  bids: { marginTop: 10 },
  bidsLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  bidRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    marginBottom: 6,
  },
  bidDriver: { fontSize: 14, fontWeight: "500", color: "#1e293b" },
  bidMeta: { fontSize: 11, color: "#94a3b8" },
  acceptBtn: {
    backgroundColor: "#0ea5e9",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  acceptBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  waiting: { fontSize: 13, color: "#94a3b8", fontStyle: "italic", marginTop: 8 },
  rateRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 4 },
  rateLabel: { fontSize: 13, color: "#475569", marginRight: 4 },
  star: { fontSize: 28, color: "#fbbf24" },
  rated: { fontSize: 12, color: "#94a3b8", marginTop: 8 },
  cancelLink: { color: "#ef4444", fontSize: 12, marginTop: 10 },
});
