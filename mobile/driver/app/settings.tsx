import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, API_BASE, getToken, User } from "../src/api";

const VEHICLE_TYPES = [
  { key: "car", label: "Car", icon: "🚗" },
  { key: "motorcycle", label: "Motorcycle", icon: "🏍️" },
  { key: "rickshaw", label: "Rickshaw", icon: "🛺" },
  { key: "van", label: "Van", icon: "🚐" },
];

export default function DriverSettings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [minFare, setMinFare] = useState("");
  const [ratePerKm, setRatePerKm] = useState("");
  const [ratePerMin, setRatePerMin] = useState("");
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch profile");
        const u = await res.json();
        setUser(u);
        setFullName(u.full_name ?? "");
        setPhone(u.phone ?? "");
        setVehicleType(u.vehicle_type ?? "car");
        setVehicleModel(u.vehicle_model ?? "");
        setVehicleColor(u.vehicle_color ?? "");
        setVehiclePlate(u.vehicle_plate ?? "");
        setMinFare(u.min_fare ? String(u.min_fare) : "");
        setRatePerKm(u.rate_per_km ? String(u.rate_per_km) : "");
        setRatePerMin(u.rate_per_min ? String(u.rate_per_min) : "");
        setIsOnline(u.is_online ?? false);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const token = await getToken();
      const body: Record<string, unknown> = {
        full_name: fullName,
        phone: phone || undefined,
        vehicle_type: vehicleType,
        vehicle_model: vehicleModel || undefined,
        vehicle_color: vehicleColor || undefined,
        vehicle_plate: vehiclePlate || undefined,
        min_fare: minFare ? Number(minFare) : undefined,
        rate_per_km: ratePerKm ? Number(ratePerKm) : undefined,
        rate_per_min: ratePerMin ? Number(ratePerMin) : undefined,
      };
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleOnline(val: boolean) {
    setIsOnline(val);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/auth/toggle-online`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setIsOnline(!val);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <Text style={styles.title}>Driver Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Online toggle */}
      <View style={styles.onlineRow}>
        <View>
          <Text style={styles.onlineLabel}>
            {isOnline ? "You're online" : "You're offline"}
          </Text>
          <Text style={styles.onlineSub}>
            {isOnline
              ? "Riders can see your bids"
              : "Go online to receive ride requests"}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={toggleOnline}
          trackColor={{ true: "#10b981", false: "#cbd5e1" }}
          thumbColor="#fff"
        />
      </View>

      {/* Vehicle type */}
      <Text style={styles.sectionTitle}>Vehicle type</Text>
      <View style={styles.typeRow}>
        {VEHICLE_TYPES.map((vt) => {
          const active = vehicleType === vt.key;
          return (
            <Pressable
              key={vt.key}
              style={[styles.typeCard, active && styles.typeCardActive]}
              onPress={() => setVehicleType(vt.key)}
            >
              <Text style={styles.typeIcon}>{vt.icon}</Text>
              <Text
                style={[
                  styles.typeLabel,
                  active && styles.typeLabelActive,
                ]}
              >
                {vt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Vehicle details */}
      <Text style={styles.sectionTitle}>Vehicle details</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Model</Text>
        <TextInput
          style={styles.input}
          value={vehicleModel}
          onChangeText={setVehicleModel}
          placeholder="e.g. Honda City 2020"
        />
        <Text style={styles.fieldLabel}>Color</Text>
        <TextInput
          style={styles.input}
          value={vehicleColor}
          onChangeText={setVehicleColor}
          placeholder="e.g. White"
        />
        <Text style={styles.fieldLabel}>Number plate</Text>
        <TextInput
          style={styles.input}
          value={vehiclePlate}
          onChangeText={setVehiclePlate}
          placeholder="e.g. ABC-123"
          autoCapitalize="characters"
        />
      </View>

      {/* Rate preferences */}
      <Text style={styles.sectionTitle}>Your rates</Text>
      <Text style={styles.sectionSub}>
        Set your preferred rates. These auto-fill your bid when a matching ride appears.
      </Text>
      <View style={styles.card}>
        <View style={styles.rateRow}>
          <View style={styles.rateCol}>
            <Text style={styles.fieldLabel}>Min fare (Rs)</Text>
            <TextInput
              style={styles.input}
              value={minFare}
              onChangeText={setMinFare}
              placeholder="150"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rateCol}>
            <Text style={styles.fieldLabel}>Per km (Rs)</Text>
            <TextInput
              style={styles.input}
              value={ratePerKm}
              onChangeText={setRatePerKm}
              placeholder="35"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rateCol}>
            <Text style={styles.fieldLabel}>Per min (Rs)</Text>
            <TextInput
              style={styles.input}
              value={ratePerMin}
              onChangeText={setRatePerMin}
              placeholder="5"
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      {/* Profile */}
      <Text style={styles.sectionTitle}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Full name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
        />
        <Text style={styles.fieldLabel}>Phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>

      {/* Save button */}
      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>
          {saving ? "Saving..." : "Save settings"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.historyBtn}
        onPress={() => router.push("/history")}
      >
        <Text style={styles.historyBtnText}>Ride history</Text>
      </Pressable>

      <Pressable
        style={styles.historyBtn}
        onPress={() => router.push("/earnings")}
      >
        <Text style={styles.historyBtnText}>Earnings</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#d1fae5",
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  backTxt: { fontSize: 22, color: "#1e293b" },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    margin: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1fae5",
  },
  onlineLabel: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  onlineSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionSub: {
    fontSize: 12,
    color: "#64748b",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  typeCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  typeCardActive: {
    borderColor: "#10b981",
    backgroundColor: "#ecfdf5",
  },
  typeIcon: { fontSize: 28, marginBottom: 4 },
  typeLabel: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  typeLabelActive: { color: "#047857" },
  card: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d1fae5",
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 4,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  rateRow: { flexDirection: "row", gap: 10 },
  rateCol: { flex: 1 },
  saveBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: "#10b981",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  historyBtn: {
    marginHorizontal: 16, marginTop: 10, padding: 16,
    alignItems: "center", borderWidth: 1, borderColor: "#d1fae5",
    borderRadius: 12, backgroundColor: "#fff",
  },
  historyBtnText: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
});
