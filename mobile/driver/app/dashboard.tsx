import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
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
  const [openRides, setOpenRides] = useState<Ride[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [open, mine] = await Promise.all([
        api.listOpenRides(),
        api.listMyRides(),
      ]);
      setOpenRides(open);
      setMyRides(mine);
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

  const sections = [
    { title: "Open Ride Requests", data: openRides, type: "open" as const },
    { title: "Your Bids & Trips", data: myRides, type: "mine" as const },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>DriveBid</Text>
          <Text style={styles.subBrand}>{user?.full_name} · Driver</Text>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, section }) =>
          section.type === "open" ? (
            <OpenRideCard ride={item} userId={user?.id ?? 0} onAction={refresh} />
          ) : (
            <MyTripCard ride={item} userId={user?.id ?? 0} onAction={refresh} />
          )
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Pull to refresh</Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

function OpenRideCard({
  ride,
  userId,
  onAction,
}: {
  ride: Ride;
  userId: number;
  onAction: () => void;
}) {
  const myBid = ride.bids.find((b) => b.driver_id === userId);
  const [amount, setAmount] = useState("");
  const [eta, setEta] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleBid() {
    if (!amount || !eta) return;
    setLoading(true);
    try {
      await api.placeBid(ride.id, {
        amount: Number(amount),
        eta_minutes: Number(eta),
        message,
      });
      setAmount("");
      setEta("");
      setMessage("");
      onAction();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardRoute}>{ride.pickup} → {ride.dropoff}</Text>
      <Text style={styles.cardMeta}>
        {ride.rider_name} · Budget {formatMoney(ride.max_budget)}
        {ride.estimated_fare != null && ` · Est. ${formatMoney(ride.estimated_fare)}`}
      </Text>
      <Text style={styles.cardMeta}>
        {ride.distance_km != null ? formatDistance(ride.distance_km) : ""}
        {ride.duration_min != null ? ` · ${formatDuration(ride.duration_min)}` : ""}
        {` · ${ride.bids.length} bid${ride.bids.length === 1 ? "" : "s"}`}
      </Text>

      {myBid ? (
        <View style={styles.myBidBox}>
          <Text style={styles.myBidText}>
            You bid {formatMoney(myBid.amount)}
          </Text>
        </View>
      ) : (
        <View style={styles.bidForm}>
          {ride.estimated_fare != null && (
            <Text style={styles.suggest}>
              Suggested: {formatMoney(ride.estimated_fare)}
            </Text>
          )}
          <View style={styles.bidRow}>
            <TextInput
              style={[styles.bidInput, { flex: 1 }]}
              placeholder={
                ride.estimated_fare != null
                  ? `~ ${Math.round(ride.estimated_fare)}`
                  : "Rs"
              }
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TextInput
              style={[styles.bidInput, { flex: 1 }]}
              placeholder="ETA (min)"
              keyboardType="numeric"
              value={eta}
              onChangeText={setEta}
            />
          </View>
          <TextInput
            style={styles.bidInput}
            placeholder="Message (optional)"
            value={message}
            onChangeText={setMessage}
          />
          <Pressable
            style={[styles.bidBtn, loading && { opacity: 0.6 }]}
            onPress={handleBid}
            disabled={loading}
          >
            <Text style={styles.bidBtnText}>
              {loading ? "Bidding..." : "Place Bid"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function MyTripCard({
  ride,
  userId,
  onAction,
}: {
  ride: Ride;
  userId: number;
  onAction: () => void;
}) {
  const myBid = ride.bids.find((b) => b.driver_id === userId);
  if (!myBid) return null;
  const amAccepted = ride.accepted_bid_id === myBid.id;

  async function doAction(fn: () => Promise<unknown>) {
    try {
      await fn();
      onAction();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardRoute}>{ride.pickup} → {ride.dropoff}</Text>
          <Text style={styles.cardMeta}>
            Bid: {formatMoney(myBid.amount)} · {ride.rider_name}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[ride.status] ?? "#94a3b8" }]}>
          <Text style={styles.badgeText}>{ride.status.replace("_", " ")}</Text>
        </View>
      </View>

      {amAccepted && ride.status === "accepted" && (
        <View style={styles.actionRow}>
          <Pressable
            style={styles.greenBtn}
            onPress={() => doAction(() => api.startRide(ride.id))}
          >
            <Text style={styles.actionBtnText}>Start Trip</Text>
          </Pressable>
          <Pressable onPress={() => doAction(() => api.cancelRide(ride.id))}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {amAccepted && ride.status === "in_progress" && (
        <Pressable
          style={styles.completeBtn}
          onPress={() => doAction(() => api.completeRide(ride.id))}
        >
          <Text style={styles.actionBtnText}>Complete Trip</Text>
        </Pressable>
      )}

      {ride.status === "completed" &&
        amAccepted &&
        ride.driver_to_rider_stars === null && (
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Rate rider:</Text>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable
                key={s}
                onPress={() => doAction(() => api.rateRide(ride.id, s, ""))}
              >
                <Text style={styles.star}>★</Text>
              </Pressable>
            ))}
          </View>
        )}

      {ride.status === "completed" &&
        amAccepted &&
        ride.driver_to_rider_stars != null && (
          <Text style={styles.rated}>
            You rated {ride.driver_to_rider_stars}★
          </Text>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 16, paddingTop: 52,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#d1fae5",
  },
  brand: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  subBrand: { fontSize: 12, color: "#64748b" },
  logoutBtn: {
    borderWidth: 1, borderColor: "#cbd5e1",
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6,
  },
  logoutText: { fontSize: 13, color: "#475569" },
  sectionHeader: {
    fontSize: 16, fontWeight: "700", color: "#1e293b",
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
  },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40, fontSize: 15 },
  card: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#fff", borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: "#d1fae5",
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  cardRoute: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginBottom: 2 },
  cardMeta: { fontSize: 12, color: "#64748b", marginBottom: 2 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  myBidBox: {
    marginTop: 8, backgroundColor: "#f1f5f9",
    borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#e2e8f0",
  },
  myBidText: { fontSize: 13, color: "#475569" },
  bidForm: { marginTop: 8 },
  suggest: { fontSize: 11, color: "#0ea5e9", marginBottom: 6 },
  bidRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  bidInput: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    padding: 10, fontSize: 14, marginBottom: 6,
  },
  bidBtn: {
    backgroundColor: "#10b981", borderRadius: 8,
    padding: 12, alignItems: "center",
  },
  bidBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  actionRow: {
    flexDirection: "row", alignItems: "center",
    gap: 12, marginTop: 10,
  },
  greenBtn: {
    backgroundColor: "#10b981", borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  completeBtn: {
    backgroundColor: "#10b981", borderRadius: 8,
    padding: 12, alignItems: "center", marginTop: 10,
  },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  cancelLink: { color: "#ef4444", fontSize: 12 },
  rateRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 4 },
  rateLabel: { fontSize: 13, color: "#475569", marginRight: 4 },
  star: { fontSize: 28, color: "#fbbf24" },
  rated: { fontSize: 12, color: "#94a3b8", marginTop: 8 },
});
