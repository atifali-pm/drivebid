import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { API_BASE, getToken, User } from "../src/api";

export default function RiderSettings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const u = await res.json();
        setUser(u);
        setFullName(u.full_name ?? "");
        setPhone(u.phone ?? "");
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone: phone || undefined }),
      });
      if (!res.ok) throw new Error("Save failed");
      Alert.alert("Saved", "Profile updated.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  }

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#06b6d4" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>
            {(fullName || "R").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{fullName || "Rider"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.referral_code && (
            <Text style={styles.referral}>Referral: {user.referral_code}</Text>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Full name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
        <Text style={styles.fieldLabel}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
      </Pressable>

      <Pressable
        style={styles.historyBtn}
        onPress={() => router.push("/history")}
      >
        <Text style={styles.historyBtnText}>Ride history</Text>
      </Pressable>
    </ScrollView>
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
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16, padding: 20, backgroundColor: "#fff" },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#06b6d4", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 24 },
  name: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  email: { fontSize: 13, color: "#64748b", marginTop: 2 },
  referral: { fontSize: 11, color: "#06b6d4", fontWeight: "700", marginTop: 4 },
  card: { margin: 16, padding: 16, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 4, marginTop: 8, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, fontSize: 15, color: "#0f172a", backgroundColor: "#f8fafc" },
  saveBtn: { marginHorizontal: 16, marginTop: 10, backgroundColor: "#06b6d4", borderRadius: 12, padding: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  historyBtn: { marginHorizontal: 16, marginTop: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff" },
  historyBtnText: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
});
