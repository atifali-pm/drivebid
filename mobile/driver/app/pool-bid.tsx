import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, Ride } from "../src/api";
import { formatDistance, formatDuration, formatMoney } from "../src/pricing";
import { WheelPicker } from "../src/WheelPicker";

const BID_VALUES = Array.from({ length: 491 }, (_, i) => 100 + i * 10);
const ETA_VALUES = Array.from({ length: 30 }, (_, i) => i + 1);

export default function PoolBid() {
  const router = useRouter();
  const [rides, setRides] = useState<Ride[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [amount, setAmount] = useState(500);
  const [eta, setEta] = useState(10);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const open = await api.listOpenRides();
        const eligible = open.filter(
          (r) => r.pool_ok && r.auction_ends_at && new Date(r.auction_ends_at) > new Date()
        );
        setRides(eligible);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size < 2) {
      Alert.alert("Pick at least 2 rides", "A pool bid needs 2 or more pool-OK rides.");
      return;
    }
    setSubmitting(true);
    try {
      await api.placePoolBid({
        ride_ids: Array.from(selected),
        amount_per_seat: amount,
        eta_minutes: eta,
        message,
      });
      router.back();
    } catch (err) {
      Alert.alert("Bid failed", err instanceof Error ? err.message : "Unknown");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <Text style={styles.title}>Pool bid</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={styles.intro}>
          Pick 2 or more pool-OK rides going the same way. They all get your bid
          at the same Rs per seat. Each rider accepts on their own.
        </Text>

        {rides.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🪑</Text>
            <Text style={styles.emptyTitle}>No pool-OK rides right now</Text>
            <Text style={styles.emptySub}>
              Come back later, or keep bidding solo on the dashboard.
            </Text>
          </View>
        ) : (
          rides.map((r) => {
            const on = selected.has(r.id);
            return (
              <Pressable
                key={r.id}
                onPress={() => toggle(r.id)}
                style={[styles.rideRow, on && styles.rideRowOn]}
              >
                <View style={[styles.check, on && styles.checkOn]}>
                  {on && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.route}>
                    {r.pickup} → {r.dropoff}
                  </Text>
                  <Text style={styles.meta}>
                    {r.rider_name ?? "Rider"} · Budget {formatMoney(r.max_budget)}
                    {r.distance_km != null && ` · ${formatDistance(r.distance_km)}`}
                    {r.duration_min != null && ` · ${formatDuration(r.duration_min)}`}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}

        {rides.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>RS PER SEAT</Text>
            <WheelPicker
              values={BID_VALUES}
              value={amount}
              onChange={setAmount}
              formatLabel={(n) => `Rs ${n}`}
              accent="#10b981"
            />

            <Text style={styles.sectionLabel}>ETA (MIN)</Text>
            <WheelPicker
              values={ETA_VALUES}
              value={eta}
              onChange={setEta}
              formatLabel={(n) => `${n} min`}
              accent="#10b981"
            />

            <TextInput
              style={styles.input}
              placeholder="Message to both riders (optional)"
              value={message}
              onChangeText={setMessage}
            />

            <Pressable
              style={[styles.submit, submitting && { opacity: 0.6 }]}
              onPress={submit}
              disabled={submitting}
            >
              <Text style={styles.submitText}>
                {submitting
                  ? "Placing..."
                  : `Pool-bid ${selected.size} ride${selected.size === 1 ? "" : "s"} at Rs ${amount}/seat`}
              </Text>
            </Pressable>
          </>
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
  intro: { fontSize: 13, color: "#475569", marginBottom: 12, lineHeight: 18 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 42, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#334155", marginBottom: 4 },
  emptySub: { fontSize: 12, color: "#64748b", textAlign: "center", maxWidth: 260 },
  rideRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  rideRowOn: {
    backgroundColor: "#ecfeff",
    borderColor: "#06b6d4",
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: "#06b6d4", borderColor: "#06b6d4" },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  route: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  meta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    marginTop: 18,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginTop: 14,
    backgroundColor: "#fff",
  },
  submit: {
    backgroundColor: "#06b6d4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 18,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
