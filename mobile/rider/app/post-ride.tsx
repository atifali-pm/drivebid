import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { api } from "../src/api";
import { LatLng, LeafletMap, LeafletMapHandle } from "../src/LeafletMap";
import { WheelPicker } from "../src/WheelPicker";

const ISLAMABAD: LatLng = { latitude: 33.6844, longitude: 73.0479 };

const RIDE_TYPES = [
  { key: "car", label: "Car", icon: "🚗" },
  { key: "motorcycle", label: "Bike", icon: "🏍️" },
  { key: "rickshaw", label: "Rickshaw", icon: "🛺" },
  { key: "van", label: "Van", icon: "🚐" },
];

// Build a list of budget values from Rs 200 to Rs 5000 in Rs 10 steps
const BUDGET_VALUES = Array.from({ length: 481 }, (_, i) => 200 + i * 10);

const SCHEDULE_OFFSETS: { label: string; min: number | null }[] = [
  { label: "Now", min: null },
  { label: "In 30 min", min: 30 },
  { label: "In 1 hour", min: 60 },
  { label: "In 2 hours", min: 120 },
  { label: "In 4 hours", min: 240 },
  { label: "In 12 hours", min: 720 },
  { label: "Tomorrow", min: 1440 },
];

export default function PostRide() {
  const router = useRouter();
  const mapRef = useRef<LeafletMapHandle | null>(null);
  const [initialCenter, setInitialCenter] = useState<LatLng>(ISLAMABAD);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [pickupLabel, setPickupLabel] = useState("");
  const [dropoffLabel, setDropoffLabel] = useState("");
  const [budget, setBudget] = useState<number>(1500);
  const [rideType, setRideType] = useState("car");
  const [notes, setNotes] = useState("");
  const [poolOk, setPoolOk] = useState(false);
  // "now" plus one of the preset offsets; null means go immediately.
  const [scheduleOffsetMin, setScheduleOffsetMin] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({});
        const here = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setInitialCenter(here);
        setPickup(here);
        setPickupLabel("My location");
        setMode("dropoff");
        mapRef.current?.center(here, 14);
        reverseGeocode(here).then((label) => setPickupLabel(label));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function reverseGeocode(coord: LatLng): Promise<string> {
    try {
      const res = await fetch(
        `https://photon.komoot.io/reverse?lat=${coord.latitude}&lon=${coord.longitude}&lang=en`
      );
      if (!res.ok) return "Pinned location";
      const data = await res.json();
      const p = data?.features?.[0]?.properties;
      if (!p) return "Pinned location";
      const parts = [p.name, p.street, p.suburb || p.district || p.city]
        .filter(Boolean);
      return parts.join(", ") || "Pinned location";
    } catch {
      return "Pinned location";
    }
  }

  async function onMapTap(coord: LatLng) {
    if (mode === "pickup") {
      setPickup(coord);
      setPickupLabel("Locating...");
      setMode("dropoff");
      const label = await reverseGeocode(coord);
      setPickupLabel(label);
    } else {
      setDropoff(coord);
      setDropoffLabel("Locating...");
      const label = await reverseGeocode(coord);
      setDropoffLabel(label);
    }
  }

  function haversineKm(a: LatLng, b: LatLng): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  const RIDE_PRICING: Record<string, { base: number; perKm: number; speed: number }> = {
    car:        { base: 150, perKm: 90,  speed: 25 },
    motorcycle:  { base: 80,  perKm: 50,  speed: 30 },
    rickshaw:   { base: 100, perKm: 60,  speed: 20 },
    van:        { base: 250, perKm: 120, speed: 22 },
  };

  const pricing = RIDE_PRICING[rideType] ?? RIDE_PRICING.car;
  const distanceKm = pickup && dropoff ? haversineKm(pickup, dropoff) : null;
  const durationMin =
    distanceKm != null ? Math.max(5, Math.round((distanceKm / pricing.speed) * 60)) : null;
  const estFare =
    distanceKm != null ? Math.round(pricing.base + distanceKm * pricing.perKm) : null;

  // Auto-fit the map to include pickup + dropoff when both are set
  useEffect(() => {
    if (pickup && dropoff) {
      mapRef.current?.fit([pickup, dropoff]);
    }
  }, [pickup?.latitude, dropoff?.latitude]);

  // Snap the budget wheel to the estimated fare + 15% buffer whenever
  // pickup or drop-off changes. This gives the rider a sensible default
  // they can then nudge up or down.
  useEffect(() => {
    if (estFare == null) return;
    const target = Math.round((estFare * 1.05) / 10) * 10;
    const clamped = Math.max(
      BUDGET_VALUES[0],
      Math.min(BUDGET_VALUES[BUDGET_VALUES.length - 1], target)
    );
    setBudget(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.latitude, dropoff?.latitude, rideType]);

  async function submit() {
    if (!pickup || !dropoff) {
      Alert.alert("Missing", "Tap the map to pick both pickup and drop-off.");
      return;
    }
    setLoading(true);
    try {
      await api.createRide({
        pickup: pickupLabel || "Pinned location",
        dropoff: dropoffLabel || "Pinned location",
        pickup_lat: pickup.latitude,
        pickup_lng: pickup.longitude,
        dropoff_lat: dropoff.latitude,
        dropoff_lng: dropoff.longitude,
        distance_km: distanceKm,
        duration_min: durationMin,
        estimated_fare: estFare,
        max_budget: budget,
        ride_type: rideType,
        notes,
        pool_ok: poolOk,
        scheduled_for:
          scheduleOffsetMin != null
            ? new Date(Date.now() + scheduleOffsetMin * 60_000).toISOString()
            : null,
      });
      router.back();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const markers = [
    ...(pickup
      ? [
          {
            id: "pickup",
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            color: "green",
            label: "Pickup",
          },
        ]
      : []),
    ...(dropoff
      ? [
          {
            id: "dropoff",
            latitude: dropoff.latitude,
            longitude: dropoff.longitude,
            color: "red",
            label: "Drop-off",
          },
        ]
      : []),
  ];
  const polyline = pickup && dropoff ? [pickup, dropoff] : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <LeafletMap
          ref={mapRef}
          initialCenter={initialCenter}
          initialZoom={14}
          tappable
          onMapTap={onMapTap}
          markers={markers}
          polyline={polyline}
        />
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeChip, mode === "pickup" && styles.modeChipActive]}
            onPress={() => setMode("pickup")}
          >
            <View style={[styles.modeDot, { backgroundColor: "#10b981" }]} />
            <Text
              style={[
                styles.modeChipText,
                mode === "pickup" && styles.modeChipTextActive,
              ]}
            >
              {pickup ? "Pickup set" : "Tap: pickup"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeChip, mode === "dropoff" && styles.modeChipActive]}
            onPress={() => setMode("dropoff")}
          >
            <View style={[styles.modeDot, { backgroundColor: "#ef4444" }]} />
            <Text
              style={[
                styles.modeChipText,
                mode === "dropoff" && styles.modeChipTextActive,
              ]}
            >
              {dropoff ? "Drop-off set" : "Tap: drop-off"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sheet}>
        <View style={styles.grab} />
        <Text style={styles.sheetTitle}>Post new ride</Text>
        <Text style={styles.sheetSub}>
          Drivers will bid in real time — pick the one you like.
        </Text>

        <View style={styles.fieldRow}>
          <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
          <TextInput
            style={styles.input}
            value={pickupLabel}
            onChangeText={setPickupLabel}
            placeholder="Pickup label"
          />
        </View>
        <View style={styles.fieldRow}>
          <View style={[styles.dot, { backgroundColor: "#ef4444" }]} />
          <TextInput
            style={styles.input}
            value={dropoffLabel}
            onChangeText={setDropoffLabel}
            placeholder="Drop-off label"
          />
        </View>

        {distanceKm != null && (
          <View style={styles.estBox}>
            <View style={styles.estCell}>
              <Text style={styles.estLabel}>DISTANCE</Text>
              <Text style={styles.estVal}>{distanceKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.estDivider} />
            <View style={styles.estCell}>
              <Text style={styles.estLabel}>DURATION</Text>
              <Text style={styles.estVal}>~ {durationMin} min</Text>
            </View>
            <View style={styles.estDivider} />
            <View style={styles.estCell}>
              <Text style={styles.estLabel}>EST. FARE</Text>
              <Text style={[styles.estVal, { color: "#06b6d4" }]}>
                Rs {estFare?.toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.label}>Ride type</Text>
        <View style={styles.rideTypeRow}>
          {RIDE_TYPES.map((rt) => {
            const active = rideType === rt.key;
            return (
              <Pressable
                key={rt.key}
                style={[styles.rideTypeCard, active && styles.rideTypeCardActive]}
                onPress={() => setRideType(rt.key)}
              >
                <Text style={styles.rideTypeIcon}>{rt.icon}</Text>
                <Text
                  style={[
                    styles.rideTypeLabel,
                    active && styles.rideTypeLabelActive,
                  ]}
                >
                  {rt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Your max budget</Text>
        <View style={styles.wheelWrap}>
          <WheelPicker
            values={BUDGET_VALUES}
            value={budget}
            onChange={setBudget}
            formatLabel={(n) => `Rs ${n.toLocaleString()}`}
          />
        </View>

        <Text style={styles.label}>When do you want to go?</Text>
        <View style={styles.scheduleRow}>
          {SCHEDULE_OFFSETS.map((opt) => {
            const on = scheduleOffsetMin === opt.min;
            return (
              <Pressable
                key={opt.label}
                onPress={() => setScheduleOffsetMin(opt.min)}
                style={[styles.scheduleChip, on && styles.scheduleChipOn]}
              >
                <Text style={[styles.scheduleChipText, on && styles.scheduleChipTextOn]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {scheduleOffsetMin != null && scheduleOffsetMin > 0 && (
          <Text style={styles.scheduleHint}>
            Drivers can bid until about 5 min before departure.
          </Text>
        )}

        <Pressable
          style={[styles.poolRow, poolOk && styles.poolRowOn]}
          onPress={() => setPoolOk((v) => !v)}
        >
          <View style={[styles.poolBox, poolOk && styles.poolBoxOn]}>
            {poolOk && <Text style={styles.poolTick}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.poolTitle}>Happy to share the ride (pool)</Text>
            <Text style={styles.poolSub}>
              Drivers can offer a shared bid with another rider going your way.
              Cheaper if matched, normal bids still come in either way.
            </Text>
          </View>
        </Pressable>

        <Text style={styles.label}>Notes for driver</Text>
        <TextInput
          style={styles.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
        />

        <Pressable
          style={[styles.submit, loading && { opacity: 0.6 }]}
          onPress={submit}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? "Posting..." : "Post ride · Get bids"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  sheetScroll: { flex: 1, marginTop: -20 },
  mapWrap: { height: 420, backgroundColor: "#e2e8f0" },
  backBtn: {
    position: "absolute",
    top: 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  backTxt: { fontSize: 22, color: "#1e293b" },
  modeRow: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 8,
  },
  modeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  modeChipActive: { backgroundColor: "#06b6d4" },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeChipText: { fontSize: 12, color: "#0f172a", fontWeight: "600" },
  modeChipTextActive: { color: "#fff" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  grab: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  sheetSub: { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 16 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#1e293b",
    backgroundColor: "#fff",
  },
  estBox: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 18,
  },
  estCell: { flex: 1, alignItems: "center" },
  estDivider: { width: 1, backgroundColor: "#e2e8f0", marginVertical: 4 },
  estLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "700",
    marginBottom: 4,
  },
  estVal: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
  label: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 4,
  },
  rideTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  rideTypeCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  rideTypeCardActive: {
    borderColor: "#06b6d4",
    backgroundColor: "#ecfeff",
  },
  rideTypeIcon: { fontSize: 24, marginBottom: 2 },
  rideTypeLabel: { fontSize: 10, fontWeight: "700", color: "#64748b" },
  rideTypeLabelActive: { color: "#0891b2" },
  wheelWrap: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  scheduleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  scheduleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  scheduleChipOn: {
    borderColor: "#06b6d4",
    backgroundColor: "#ecfeff",
  },
  scheduleChipText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  scheduleChipTextOn: { color: "#0891b2", fontWeight: "800" },
  scheduleHint: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 10,
    fontStyle: "italic",
  },
  poolRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    marginBottom: 14,
    marginTop: 6,
  },
  poolRowOn: {
    borderColor: "#06b6d4",
    backgroundColor: "#ecfeff",
  },
  poolBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  poolBoxOn: { borderColor: "#06b6d4", backgroundColor: "#06b6d4" },
  poolTick: { color: "#fff", fontSize: 14, fontWeight: "800" },
  poolTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  poolSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  notes: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#1e293b",
    marginBottom: 16,
  },
  submit: {
    backgroundColor: "#06b6d4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
