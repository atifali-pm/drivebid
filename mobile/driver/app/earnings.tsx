import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

const RECENT = [
  { id: 1, time: "12:24 PM", route: "F-7 Markaz → G-9/4", rider: "Sara Ahmed", amount: 1500, tip: 0 },
  { id: 2, time: "11:08 AM", route: "Blue Area → Centaurus Mall", rider: "Ayesha Noor", amount: 620, tip: 50 },
  { id: 3, time: "09:52 AM", route: "DHA Phase 1 → Airport", rider: "Imran Khan", amount: 2100, tip: 100 },
  { id: 4, time: "08:40 AM", route: "F-10 → I-8 Markaz", rider: "Omar Farooq", amount: 480, tip: 0 },
];

export default function Earnings() {
  const router = useRouter();
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Text style={styles.iconTxt}>←</Text>
        </Pressable>
        <Text style={styles.title}>Earnings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>TODAY</Text>
        <Text style={styles.heroAmount}>Rs 4,750</Text>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaCell}>
            <Text style={styles.heroMetaVal}>7</Text>
            <Text style={styles.heroMetaLbl}>trips</Text>
          </View>
          <View style={styles.heroMetaDiv} />
          <View style={styles.heroMetaCell}>
            <Text style={styles.heroMetaVal}>6h 20m</Text>
            <Text style={styles.heroMetaLbl}>online</Text>
          </View>
          <View style={styles.heroMetaDiv} />
          <View style={styles.heroMetaCell}>
            <Text style={styles.heroMetaVal}>★ 4.9</Text>
            <Text style={styles.heroMetaLbl}>rating</Text>
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>THIS WEEK</Text>
          <Text style={styles.statAmount}>Rs 28,450</Text>
          <Text style={styles.statMeta}>42 trips</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>THIS MONTH</Text>
          <Text style={styles.statAmount}>Rs 112,800</Text>
          <Text style={styles.statMeta}>168 trips</Text>
        </View>
      </View>

      <View style={styles.breakdown}>
        <Text style={styles.sectionTitle}>Today's breakdown</Text>
        <View style={styles.brRow}>
          <Text style={styles.brLabel}>Fare earned</Text>
          <Text style={styles.brVal}>Rs 4,600</Text>
        </View>
        <View style={styles.brRow}>
          <Text style={styles.brLabel}>Tips</Text>
          <Text style={styles.brVal}>Rs 150</Text>
        </View>
        <View style={styles.brRow}>
          <Text style={styles.brLabel}>Platform fee (10%)</Text>
          <Text style={[styles.brVal, { color: "#ef4444" }]}>− Rs 460</Text>
        </View>
        <View style={[styles.brRow, styles.brTotal]}>
          <Text style={styles.brTotalLabel}>You keep</Text>
          <Text style={styles.brTotalVal}>Rs 4,290</Text>
        </View>
      </View>

      <View style={styles.recentBox}>
        <Text style={styles.sectionTitle}>Recent trips</Text>
        {RECENT.map((t) => (
          <View key={t.id} style={styles.tripRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripRoute}>{t.route}</Text>
              <Text style={styles.tripMeta}>
                {t.time} · {t.rider}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.tripAmount}>Rs {t.amount.toLocaleString()}</Text>
              {t.tip > 0 && (
                <Text style={styles.tripTip}>+ Rs {t.tip} tip</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <Pressable style={styles.payoutBtn}>
        <Text style={styles.payoutTxt}>Cash out to bank · Rs 4,290</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  iconTxt: { fontSize: 22, color: "#1e293b" },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  heroCard: {
    margin: 16,
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 22,
  },
  heroLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  heroAmount: { color: "#fff", fontSize: 40, fontWeight: "800", marginVertical: 8 },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 12,
  },
  heroMetaCell: { flex: 1, alignItems: "center" },
  heroMetaDiv: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.15)" },
  heroMetaVal: { color: "#fff", fontWeight: "700", fontSize: 15 },
  heroMetaLbl: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  row: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 14 },
  stat: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14,
  },
  statLabel: { fontSize: 10, color: "#64748b", fontWeight: "700", letterSpacing: 0.6 },
  statAmount: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginTop: 6 },
  statMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  breakdown: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 10 },
  brRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  brLabel: { color: "#475569", fontSize: 13 },
  brVal: { color: "#0f172a", fontSize: 13, fontWeight: "600" },
  brTotal: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  brTotalLabel: { color: "#0f172a", fontWeight: "700", fontSize: 14 },
  brTotalVal: { color: "#06b6d4", fontWeight: "800", fontSize: 16 },
  recentBox: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  tripRoute: { fontSize: 13, color: "#0f172a", fontWeight: "600" },
  tripMeta: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  tripAmount: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
  tripTip: { fontSize: 10, color: "#10b981", fontWeight: "600" },
  payoutBtn: {
    marginHorizontal: 16,
    backgroundColor: "#06b6d4",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  payoutTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
