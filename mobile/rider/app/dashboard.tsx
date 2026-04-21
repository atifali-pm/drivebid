import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, Ride } from "../src/api";
import { useAuth } from "../src/useAuth";
import { formatDistance, formatDuration, formatMoney } from "../src/pricing";
import { DisputeModal } from "../src/DisputeModal";
import { LeafletMap } from "../src/LeafletMap";
import { AuctionTimer } from "../src/AuctionTimer";

function vehicleEmoji(t: string | null | undefined): string {
  return t === "motorcycle" ? "🏍️" : t === "rickshaw" ? "🛺" : t === "van" ? "🚐" : "🚗";
}

// Flip to true to render hardcoded data for portfolio screenshots. Leave false for normal use.
const SCREENSHOT_MODE = false;

const MOCK_USER_NAME = "Sara Ahmed";

const MOCK_RIDES: Ride[] = [
  {
    id: 101,
    rider_id: 1,
    rider_name: MOCK_USER_NAME,
    pickup: "F-7 Markaz",
    dropoff: "G-9/4",
    pickup_lat: 33.7215,
    pickup_lng: 73.0433,
    dropoff_lat: 33.6849,
    dropoff_lng: 73.0247,
    distance_km: 6.8,
    duration_min: 16,
    estimated_fare: 1450,
    max_budget: 2000,
    notes: "",
    status: "open",
    accepted_bid_id: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    cancelled_by: null,
    rider_to_driver_stars: null,
    rider_to_driver_comment: null,
    driver_to_rider_stars: null,
    driver_to_rider_comment: null,
    created_at: "2026-04-14T12:00:00Z",
    bids: [
      { id: 1, ride_id: 101, driver_id: 2, driver_name: "Bilal Hussain", amount: 1500, eta_minutes: 4, message: "On my way", status: "pending", created_at: "" },
      { id: 2, ride_id: 101, driver_id: 3, driver_name: "Ahmed Raza", amount: 1650, eta_minutes: 3, message: "AC sedan", status: "pending", created_at: "" },
      { id: 3, ride_id: 101, driver_id: 4, driver_name: "Imran Khan", amount: 1700, eta_minutes: 6, message: "", status: "pending", created_at: "" },
    ],
  },
  {
    id: 102,
    rider_id: 1,
    rider_name: MOCK_USER_NAME,
    pickup: "DHA Phase 2",
    dropoff: "Centaurus Mall",
    pickup_lat: null,
    pickup_lng: null,
    dropoff_lat: null,
    dropoff_lng: null,
    distance_km: 9.2,
    duration_min: 22,
    estimated_fare: 1600,
    max_budget: 1800,
    notes: "",
    status: "completed",
    accepted_bid_id: 4,
    started_at: "2026-04-14T10:00:00Z",
    completed_at: "2026-04-14T10:24:00Z",
    cancelled_at: null,
    cancelled_by: null,
    rider_to_driver_stars: null,
    rider_to_driver_comment: null,
    driver_to_rider_stars: null,
    driver_to_rider_comment: null,
    created_at: "2026-04-14T09:55:00Z",
    bids: [
      { id: 4, ride_id: 102, driver_id: 5, driver_name: "Fatima Sheikh", amount: 1550, eta_minutes: 5, message: "", status: "accepted", created_at: "" },
    ],
  },
];

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
  const params = useLocalSearchParams<{ show?: string }>();
  const filteredMock =
    SCREENSHOT_MODE && params.show === "bids"
      ? MOCK_RIDES.filter((r) => r.status === "open")
      : SCREENSHOT_MODE && params.show === "rating"
      ? MOCK_RIDES.filter((r) => r.status === "completed")
      : SCREENSHOT_MODE
      ? MOCK_RIDES
      : [];
  const [rides, setRides] = useState<Ride[]>(filteredMock);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(async () => {
    if (SCREENSHOT_MODE) {
      setRides(filteredMock);
      return;
    }
    try {
      setRides(await api.listMyRides());
    } catch {
      /* ignore */
    }
  }, [filteredMock]);

  useEffect(() => {
    if (SCREENSHOT_MODE) return;
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
          <Text style={styles.subBrand}>
            {user?.full_name ?? MOCK_USER_NAME} · Rider
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => router.push("/settings")} style={styles.gearBtn}>
            <Text style={styles.gearText}>⚙</Text>
          </Pressable>
          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.newRideBtn,
          pressed && { opacity: 0.8 },
        ]}
        android_ripple={{ color: "rgba(255,255,255,0.3)" }}
        onPress={() => { Vibration.vibrate(35); router.push("/post-ride"); }}
      >
        <Text style={styles.newRideText}>+ Post New Ride</Text>
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
  const router = useRouter();
  const [disputeOpen, setDisputeOpen] = useState(false);
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
        <>
          <View style={styles.acceptedBar}>
            <Text style={styles.acceptedText}>
              {accepted.driver_vehicle_type === "motorcycle" ? "🏍️" : accepted.driver_vehicle_type === "rickshaw" ? "🛺" : accepted.driver_vehicle_type === "van" ? "🚐" : "🚗"}{" "}
              {accepted.driver_name} · {formatMoney(accepted.amount)} · ETA{" "}
              {accepted.eta_minutes}m
            </Text>
            {accepted.driver_vehicle_plate && (
              <Text style={styles.plateText}>
                {accepted.driver_vehicle_model ?? ""} · {accepted.driver_vehicle_plate}
              </Text>
            )}
          </View>
          {(ride.status === "accepted" || ride.status === "in_progress") && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable
                style={[styles.trackBtn, { flex: 1 }]}
                onPress={() => router.push(`/trip-map?rideId=${ride.id}`)}
              >
                <Text style={styles.trackBtnText}>Track on map</Text>
              </Pressable>
              <Pressable
                style={[styles.chatDashBtn, { flex: 1 }]}
                onPress={() =>
                  router.push(
                    `/chat?rideId=${ride.id}&otherName=${encodeURIComponent(accepted?.driver_name ?? "Driver")}`
                  )
                }
              >
                <Text style={styles.chatDashTxt}>Chat</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {ride.status === "open" && (
        <AuctionTimer
          auctionEndsAt={ride.auction_ends_at}
          bidCount={ride.bids.length}
          lowestBid={
            ride.bids.length > 0
              ? Math.min(...ride.bids.map((b) => b.amount))
              : null
          }
        />
      )}

      {ride.status === "open" && ride.bids.length > 0 && (
        <View style={styles.bids}>
          <Text style={styles.bidsLabel}>
            Bids ({ride.bids.length})
          </Text>

          {ride.pickup_lat != null && ride.pickup_lng != null && (
            (() => {
              const bidsWithLoc = ride.bids.filter(
                (b) => b.driver_lat != null && b.driver_lng != null
              );
              if (bidsWithLoc.length === 0) return null;
              return (
                <View style={styles.previewMap}>
                  <LeafletMap
                    initialCenter={{
                      latitude: ride.pickup_lat,
                      longitude: ride.pickup_lng,
                    }}
                    initialZoom={13}
                    markers={[
                      {
                        id: "pickup",
                        latitude: ride.pickup_lat,
                        longitude: ride.pickup_lng,
                        color: "green",
                        label: "Pickup",
                      },
                      ...bidsWithLoc.map((b) => ({
                        id: `driver-${b.id}`,
                        latitude: b.driver_lat as number,
                        longitude: b.driver_lng as number,
                        icon: vehicleEmoji(b.driver_vehicle_type),
                        label: b.driver_name ?? "Driver",
                      })),
                    ]}
                  />
                </View>
              );
            })()
          )}

          {ride.bids
            .sort((a, b) => a.amount - b.amount)
            .map((bid) => (
              <View key={bid.id} style={styles.bidRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bidDriver}>
                    {bid.driver_vehicle_type === "motorcycle" ? "🏍️" : bid.driver_vehicle_type === "rickshaw" ? "🛺" : bid.driver_vehicle_type === "van" ? "🚐" : "🚗"}{" "}
                    {bid.driver_name ?? "Driver"} — {formatMoney(bid.amount)}
                  </Text>
                  <Text style={styles.bidMeta}>
                    ETA {bid.eta_minutes}m{bid.message ? ` · ${bid.message}` : ""}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.acceptBtn,
                    pressed && { opacity: 0.75 },
                  ]}
                  android_ripple={{ color: "rgba(255,255,255,0.3)" }}
                  onPress={() => { Vibration.vibrate(40); acceptBid(bid.id); }}
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

      {ride.status === "completed" && accepted && (
        <View style={styles.paidRow}>
          <Text style={styles.paidText}>
            ✓ Paid {formatMoney(accepted.amount)} to {accepted.driver_name}
          </Text>
          <Pressable onPress={() => setDisputeOpen(true)}>
            <Text style={styles.reportLink}>Report issue</Text>
          </Pressable>
        </View>
      )}

      {(ride.status === "open" || ride.status === "accepted") && (
        <Pressable onPress={cancel}>
          <Text style={styles.cancelLink}>Cancel ride</Text>
        </Pressable>
      )}

      <DisputeModal
        visible={disputeOpen}
        rideId={ride.id}
        role="rider"
        onClose={() => setDisputeOpen(false)}
      />
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
  gearBtn: {
    borderWidth: 1, borderColor: "#cbd5e1",
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  gearText: { fontSize: 16 },
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
  plateText: { fontSize: 11, color: "#3b82f6", fontWeight: "700", marginTop: 4 },
  bids: { marginTop: 10 },
  previewMap: {
    height: 180,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: "#e2e8f0",
  },
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
  paidRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    backgroundColor: "#ecfdf5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  paidText: { color: "#047857", fontSize: 12, fontWeight: "700" },
  reportLink: { color: "#dc2626", fontSize: 11, fontWeight: "600" },
  trackBtn: {
    backgroundColor: "#06b6d4",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  trackBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chatDashBtn: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  chatDashTxt: { color: "#1d4ed8", fontWeight: "700", fontSize: 14 },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  quickChip: {
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  quickChipText: { color: "#0891b2", fontSize: 12, fontWeight: "600" },
});
