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
  Vibration,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, Ride } from "../src/api";
import { useAuth } from "../src/useAuth";
import { formatDistance, formatDuration, formatMoney } from "../src/pricing";
import { WheelPicker } from "../src/WheelPicker";
import { DisputeModal } from "../src/DisputeModal";
import { AuctionTimer } from "../src/AuctionTimer";

const SCREENSHOT_MODE = false;
const MOCK_DRIVER_NAME = "Bilal Hussain";
const MOCK_DRIVER_ID = 99;

const MOCK_OPEN_RIDES: Ride[] = [
  {
    id: 201, rider_id: 11, rider_name: "Sara Ahmed",
    pickup: "F-7 Markaz", dropoff: "G-9/4",
    pickup_lat: 33.7215, pickup_lng: 73.0433,
    dropoff_lat: 33.6849, dropoff_lng: 73.0247,
    distance_km: 6.8, duration_min: 16, estimated_fare: 1450,
    max_budget: 2000, notes: "AC please",
    status: "open", accepted_bid_id: null,
    started_at: null, completed_at: null, cancelled_at: null, cancelled_by: null,
    rider_to_driver_stars: null, rider_to_driver_comment: null,
    driver_to_rider_stars: null, driver_to_rider_comment: null,
    created_at: "2026-04-14T12:00:00Z",
    bids: [],
  },
  {
    id: 202, rider_id: 12, rider_name: "Imran Khan",
    pickup: "Centaurus Mall", dropoff: "Islamabad Int'l Airport",
    pickup_lat: null, pickup_lng: null, dropoff_lat: null, dropoff_lng: null,
    distance_km: 24.3, duration_min: 32, estimated_fare: 1850,
    max_budget: 2200, notes: "",
    status: "open", accepted_bid_id: null,
    started_at: null, completed_at: null, cancelled_at: null, cancelled_by: null,
    rider_to_driver_stars: null, rider_to_driver_comment: null,
    driver_to_rider_stars: null, driver_to_rider_comment: null,
    created_at: "2026-04-14T11:58:00Z",
    bids: [
      { id: 10, ride_id: 202, driver_id: 7, driver_name: "Ahmed Raza", amount: 1900, eta_minutes: 6, message: "", status: "pending", created_at: "" },
      { id: 11, ride_id: 202, driver_id: 8, driver_name: "Usman Tariq", amount: 2000, eta_minutes: 4, message: "", status: "pending", created_at: "" },
    ],
  },
  {
    id: 203, rider_id: 13, rider_name: "Fatima Sheikh",
    pickup: "Blue Area", dropoff: "Bahria Town Phase 7",
    pickup_lat: null, pickup_lng: null, dropoff_lat: null, dropoff_lng: null,
    distance_km: 12.6, duration_min: 24, estimated_fare: 950,
    max_budget: 1200, notes: "",
    status: "open", accepted_bid_id: null,
    started_at: null, completed_at: null, cancelled_at: null, cancelled_by: null,
    rider_to_driver_stars: null, rider_to_driver_comment: null,
    driver_to_rider_stars: null, driver_to_rider_comment: null,
    created_at: "2026-04-14T11:55:00Z",
    bids: [
      { id: 12, ride_id: 203, driver_id: 9, driver_name: "Kamran Ali", amount: 1000, eta_minutes: 7, message: "", status: "pending", created_at: "" },
    ],
  },
];

const MOCK_MY_RIDES: Ride[] = [
  {
    id: 299, rider_id: 14, rider_name: "Hira Malik",
    pickup: "DHA Phase 1", dropoff: "Saidpur Village",
    pickup_lat: null, pickup_lng: null, dropoff_lat: null, dropoff_lng: null,
    distance_km: 8.4, duration_min: 19, estimated_fare: 1250,
    max_budget: 1500, notes: "",
    status: "accepted", accepted_bid_id: 50,
    started_at: null, completed_at: null, cancelled_at: null, cancelled_by: null,
    rider_to_driver_stars: null, rider_to_driver_comment: null,
    driver_to_rider_stars: null, driver_to_rider_comment: null,
    created_at: "2026-04-14T11:50:00Z",
    bids: [
      { id: 50, ride_id: 299, driver_id: MOCK_DRIVER_ID, driver_name: MOCK_DRIVER_NAME, amount: 1300, eta_minutes: 5, message: "On my way", status: "accepted", created_at: "" },
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
  const initialOpen =
    SCREENSHOT_MODE && params.show === "bid"
      ? MOCK_OPEN_RIDES.slice(0, 1)
      : SCREENSHOT_MODE
      ? MOCK_OPEN_RIDES
      : [];
  const initialMine =
    SCREENSHOT_MODE && params.show === "bid"
      ? []
      : SCREENSHOT_MODE
      ? MOCK_MY_RIDES
      : [];
  const [openRides, setOpenRides] = useState<Ride[]>(initialOpen);
  const [myRides, setMyRides] = useState<Ride[]>(initialMine);
  const [archivedRides, setArchivedRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function dismissRide(ride: Ride) {
    Vibration.vibrate(50);
    // Optimistic: remove from list instantly
    setOpenRides((prev) => prev.filter((r) => r.id !== ride.id));
    setArchivedRides((prev) => [...prev, ride]);
    showToast("Moved to archive");
    // Fire API in background
    api.hideRide(ride.id).catch(() => {
      // Revert on failure
      setOpenRides((prev) => [...prev, ride]);
      setArchivedRides((prev) => prev.filter((r) => r.id !== ride.id));
    });
  }

  const refresh = useCallback(async () => {
    if (SCREENSHOT_MODE) {
      setOpenRides(initialOpen);
      setMyRides(initialMine);
      return;
    }
    try {
      const [open, mine, hidden] = await Promise.all([
        api.listOpenRides(),
        api.listMyRides(),
        api.listHiddenRides(),
      ]);
      setOpenRides(open);
      setMyRides(mine);
      setArchivedRides(hidden);
    } catch {
      /* ignore */
    }
  }, [initialOpen, initialMine]);

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

  const sections = [
    { title: "Open Ride Requests", data: openRides, type: "open" as const },
    { title: "Your Bids & Trips", data: myRides, type: "mine" as const },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>DriveBid</Text>
          <Text style={styles.subBrand}>
            {user?.full_name ?? MOCK_DRIVER_NAME} · Driver
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

      {SCREENSHOT_MODE && (
        <View style={styles.quickRow}>
          <Pressable style={styles.quickChip} onPress={() => router.push("/trip-map")}>
            <Text style={styles.quickChipText}>Trip nav</Text>
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => router.push("/earnings")}>
            <Text style={styles.quickChipText}>Earnings</Text>
          </Pressable>
        </View>
      )}

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
            <OpenRideCard ride={item} userId={user?.id ?? 0} onAction={refresh} onDismiss={dismissRide} />
          ) : (
            <MyTripCard ride={item} userId={user?.id ?? 0} onAction={refresh} />
          )
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Pull to refresh</Text>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            {openRides.filter((r) => r.pool_ok).length >= 2 && (
              <Pressable
                style={styles.poolRow}
                android_ripple={{ color: "rgba(6,182,212,0.2)" }}
                onPress={() => router.push("/pool-bid")}
              >
                <View style={styles.poolIconWrap}>
                  <Text style={styles.poolIcon}>🪑</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.poolRowTitle}>Pool bid</Text>
                  <Text style={styles.poolRowSub}>
                    {openRides.filter((r) => r.pool_ok).length} rides open to sharing
                  </Text>
                </View>
                <Text style={styles.archiveChevron}>›</Text>
              </Pressable>
            )}
            {archivedRides.length > 0 && (
              <Pressable
                style={styles.archiveRow}
                android_ripple={{ color: "rgba(148,163,184,0.2)" }}
                onPress={() => router.push("/archived")}
              >
                <View style={styles.archiveIconWrap}>
                  <Text style={styles.archiveIcon}>📦</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.archiveRowTitle}>Archived</Text>
                  <Text style={styles.archiveRowSub}>
                    {archivedRides.length} ride
                    {archivedRides.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <Text style={styles.archiveChevron}>›</Text>
              </Pressable>
            )}
          </View>
        }
      />
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// Bid amount values: Rs 100 up to Rs 5000 in Rs 10 steps (491 items)
const BID_AMOUNT_VALUES = Array.from({ length: 491 }, (_, i) => 100 + i * 10);
// ETA values: 1..30 min
const BID_ETA_VALUES = Array.from({ length: 30 }, (_, i) => i + 1);

function OpenRideCard({
  ride,
  userId,
  onAction,
  onDismiss,
}: {
  ride: Ride;
  userId: number;
  onAction: () => void;
  onDismiss?: (ride: Ride) => void;
}) {
  const effectiveUserId = SCREENSHOT_MODE ? MOCK_DRIVER_ID : userId;
  const myBid = ride.bids.find((b) => b.driver_id === effectiveUserId);
  // Default the amount to the estimated fare (rounded to nearest 10), clamped
  // into our picker range.
  const suggested =
    ride.estimated_fare != null
      ? Math.round(ride.estimated_fare / 10) * 10
      : 500;
  const clampedSuggested = Math.max(
    BID_AMOUNT_VALUES[0],
    Math.min(BID_AMOUNT_VALUES[BID_AMOUNT_VALUES.length - 1], suggested)
  );
  const [amount, setAmount] = useState<number>(clampedSuggested);
  const [eta, setEta] = useState<number>(5);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [auctionTick, setAuctionTick] = useState(() => Date.now());

  const auctionClosed =
    ride.auction_ends_at != null &&
    auctionTick > new Date(ride.auction_ends_at).getTime();

  // Re-render this card every second while the auction is open, so the
  // closed/bid-form state flips the instant the window elapses.
  useEffect(() => {
    if (!ride.auction_ends_at || auctionClosed) return;
    const t = setInterval(() => setAuctionTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ride.auction_ends_at, auctionClosed]);

  // Only expose bid amounts below the driver's previous bid (undercut rule)
  const allowedBidValues = myBid
    ? BID_AMOUNT_VALUES.filter((v) => v < myBid.amount)
    : BID_AMOUNT_VALUES;

  async function handleBid() {
    setLoading(true);
    try {
      await api.placeBid(ride.id, {
        amount,
        eta_minutes: eta,
        message,
      });
      setMessage("");
      onAction();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  function handleHide() {
    if (onDismiss) onDismiss(ride);
  }

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded((e) => !e)}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.rideTypeIcon}>
            {ride.ride_type === "motorcycle" ? "🏍️" : ride.ride_type === "rickshaw" ? "🛺" : ride.ride_type === "van" ? "🚐" : "🚗"}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardRoute}>{ride.pickup} → {ride.dropoff}</Text>
          </View>
          <Text style={styles.expandChevron}>{expanded ? "▲" : "▼"}</Text>
          <Pressable
            onPress={handleHide}
            android_ripple={{ color: "rgba(239,68,68,0.2)" }}
            style={({ pressed }) => [
              styles.archiveBtn,
              pressed && styles.archiveBtnPressed,
            ]}
          >
            <Text style={styles.archiveBtnText}>📦 Archive</Text>
          </Pressable>
        </View>
        <View style={styles.budgetBanner}>
          <Text style={styles.budgetBannerLabel}>MAX BUDGET</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {ride.pool_ok && (
              <Text style={styles.poolBadge}>POOL OK</Text>
            )}
            <Text style={styles.budgetBannerAmount}>{formatMoney(ride.max_budget)}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>
          {ride.rider_name}
          {ride.estimated_fare != null && ` · Est. ${formatMoney(ride.estimated_fare)}`}
        </Text>
        <Text style={styles.cardMeta}>
          {ride.distance_km != null ? formatDistance(ride.distance_km) : ""}
          {ride.duration_min != null ? ` · ${formatDuration(ride.duration_min)}` : ""}
          {` · ${ride.bids.length} bid${ride.bids.length === 1 ? "" : "s"}`}
        </Text>
      </Pressable>

      <AuctionTimer
        auctionEndsAt={ride.auction_ends_at}
        bidCount={ride.bids.length}
        lowestBid={
          ride.bids.length > 0
            ? Math.min(...ride.bids.map((b) => b.amount))
            : null
        }
      />

      {auctionClosed ? (
        myBid ? (
          <View style={styles.myBidBox}>
            <Text style={styles.myBidText}>
              Your final bid: {formatMoney(myBid.amount)}
            </Text>
          </View>
        ) : null
      ) : expanded ? (
        <View style={styles.bidForm}>
          {myBid ? (
            <Text style={[styles.suggest, { color: "#c2410c" }]}>
              Your last bid: Rs {myBid.amount}. New bid must be lower.
            </Text>
          ) : ride.estimated_fare != null ? (
            <Text style={styles.suggest}>
              Suggested: {formatMoney(ride.estimated_fare)}
            </Text>
          ) : null}
          <View style={styles.wheelRow}>
            <Text style={styles.wheelLabel}>YOUR BID</Text>
            <WheelPicker
              values={allowedBidValues}
              value={amount}
              onChange={setAmount}
              formatLabel={(n) => `Rs ${n}`}
              accent="#10b981"
            />
            <Text style={[styles.wheelLabel, { marginTop: 10 }]}>
              ETA (MIN)
            </Text>
            <WheelPicker
              values={BID_ETA_VALUES}
              value={eta}
              onChange={setEta}
              formatLabel={(n) => `${n} min`}
              accent="#10b981"
            />
          </View>
          <TextInput
            style={styles.bidInput}
            placeholder="Message (optional)"
            value={message}
            onChangeText={setMessage}
          />
          <Pressable
            android_ripple={{ color: "rgba(255,255,255,0.3)" }}
            style={({ pressed }) => [
              styles.bidBtn,
              loading && { opacity: 0.6 },
              pressed && styles.bidBtnPressed,
            ]}
            onPress={() => { Vibration.vibrate(40); handleBid(); }}
            disabled={loading}
          >
            <Text style={styles.bidBtnText}>
              {loading ? "Bidding..." : `Place Bid · Rs ${amount}`}
            </Text>
          </Pressable>
        </View>
      ) : null}
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
  const router = useRouter();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const effectiveUserId = SCREENSHOT_MODE ? MOCK_DRIVER_ID : userId;
  const myBid = ride.bids.find((b) => b.driver_id === effectiveUserId);
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

      {amAccepted &&
        (ride.status === "accepted" || ride.status === "in_progress") && (
          <View style={{ gap: 8, marginTop: 10 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                android_ripple={{ color: "rgba(255,255,255,0.3)" }}
                style={({ pressed }) => [
                  styles.navBtn, { flex: 1 },
                  pressed && styles.btnPressed,
                ]}
                onPress={() => { Vibration.vibrate(35); router.push(`/trip-map?rideId=${ride.id}`); }}
              >
                <Text style={styles.actionBtnText}>
                  {ride.status === "accepted" ? "Navigate" : "Trip map"}
                </Text>
              </Pressable>
              <Pressable
                android_ripple={{ color: "rgba(29,78,216,0.2)" }}
                style={({ pressed }) => [
                  styles.chatDashBtn, { flex: 1 },
                  pressed && styles.btnPressed,
                ]}
                onPress={() => { Vibration.vibrate(35); router.push(`/chat?rideId=${ride.id}&otherName=${encodeURIComponent(ride.rider_name ?? "Rider")}`); }}
              >
                <Text style={styles.chatDashTxt}>Chat</Text>
              </Pressable>
            </View>
          </View>
        )}
      {amAccepted && ride.status === "accepted" && (
        <Pressable
          style={{ alignSelf: "flex-end", marginTop: 6 }}
          onPress={() => doAction(() => api.cancelRide(ride.id))}
        >
          <Text style={styles.cancelLink}>Cancel</Text>
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

      {ride.status === "completed" && amAccepted && (
        <View style={styles.paidRow}>
          <Text style={styles.paidText}>
            ✓ {formatMoney(myBid.amount)} collected
          </Text>
          <Pressable onPress={() => setDisputeOpen(true)}>
            <Text style={styles.reportLink}>Report issue</Text>
          </Pressable>
        </View>
      )}

      <DisputeModal
        visible={disputeOpen}
        rideId={ride.id}
        role="driver"
        onClose={() => setDisputeOpen(false)}
      />
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
  gearBtn: {
    borderWidth: 1, borderColor: "#cbd5e1",
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  gearText: { fontSize: 16 },
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
  rideTypeIcon: { fontSize: 24, marginRight: 4 },
  cardHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardRoute: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginBottom: 2 },
  archiveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  archiveBtnPressed: {
    backgroundColor: "#fde68a",
    borderColor: "#f59e0b",
  },
  archiveBtnText: { fontSize: 11, color: "#92400e", fontWeight: "700" },
  expandChevron: { fontSize: 12, color: "#94a3b8", marginRight: 8 },
  cardMeta: { fontSize: 12, color: "#64748b", marginBottom: 2 },
  budgetBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderColor: "#10b981",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  budgetBannerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#065f46",
    letterSpacing: 0.5,
  },
  budgetBannerAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#059669",
  },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  myBidBox: {
    marginTop: 8, backgroundColor: "#f1f5f9",
    borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#e2e8f0",
  },
  myBidText: { fontSize: 13, color: "#475569" },
  bidForm: { marginTop: 8 },
  suggest: { fontSize: 11, color: "#0ea5e9", marginBottom: 6 },
  wheelRow: {
    marginVertical: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  wheelLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  bidInput: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    padding: 10, fontSize: 14, marginBottom: 6,
  },
  bidBtn: {
    backgroundColor: "#10b981", borderRadius: 10,
    padding: 14, alignItems: "center",
  },
  bidBtnPressed: { opacity: 0.7 },
  bidBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
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
  navBtn: {
    backgroundColor: "#06b6d4", borderRadius: 10,
    padding: 14, alignItems: "center",
  },
  btnPressed: { opacity: 0.7 },
  chatDashBtn: {
    backgroundColor: "#eff6ff", borderRadius: 10,
    padding: 14, alignItems: "center",
    borderWidth: 1, borderColor: "#93c5fd",
  },
  chatDashTxt: { color: "#1d4ed8", fontWeight: "700", fontSize: 14 },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  cancelLink: { color: "#ef4444", fontSize: 12 },
  rateRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 4 },
  rateLabel: { fontSize: 13, color: "#475569", marginRight: 4 },
  star: { fontSize: 28, color: "#fbbf24" },
  rated: { fontSize: 12, color: "#94a3b8", marginTop: 8 },
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
  poolRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfeff",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#06b6d4",
  },
  poolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#cffafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  poolIcon: { fontSize: 18 },
  poolRowTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  poolRowSub: { fontSize: 12, color: "#0891b2", marginTop: 2 },
  poolBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0891b2",
    backgroundColor: "#cffafe",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    letterSpacing: 0.5,
    overflow: "hidden",
  },
  archiveRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  archiveIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  archiveIcon: { fontSize: 18 },
  archiveRowTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  archiveRowSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  archiveChevron: { fontSize: 24, color: "#cbd5e1", fontWeight: "300" },
  toast: {
    position: "absolute",
    bottom: 80,
    left: 24,
    right: 24,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  quickChip: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#6ee7b7",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  quickChipText: { color: "#047857", fontSize: 12, fontWeight: "600" },
});
