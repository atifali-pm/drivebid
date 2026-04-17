import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, DisputeCategory } from "./api";

interface DisputeModalProps {
  visible: boolean;
  rideId: number;
  /**
   * Category set differs slightly between rider and driver — rider reports
   * driver behavior, driver reports rider behavior, etc.
   */
  role: "rider" | "driver";
  onClose: () => void;
  onSubmitted?: () => void;
}

const RIDER_CATEGORIES: { key: DisputeCategory; label: string }[] = [
  { key: "driver_behavior", label: "Driver behavior" },
  { key: "route_issue", label: "Wrong route" },
  { key: "payment_issue", label: "Payment issue" },
  { key: "safety", label: "Safety concern" },
  { key: "other", label: "Other" },
];

const DRIVER_CATEGORIES: { key: DisputeCategory; label: string }[] = [
  { key: "rider_behavior", label: "Rider behavior" },
  { key: "payment_issue", label: "Payment issue" },
  { key: "safety", label: "Safety concern" },
  { key: "other", label: "Other" },
];

export function DisputeModal({
  visible,
  rideId,
  role,
  onClose,
  onSubmitted,
}: DisputeModalProps) {
  const [category, setCategory] = useState<DisputeCategory>(
    role === "rider" ? "driver_behavior" : "rider_behavior"
  );
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const categories = role === "rider" ? RIDER_CATEGORIES : DRIVER_CATEGORIES;

  async function submit() {
    if (description.trim().length < 5) {
      Alert.alert("Too short", "Please describe the issue (at least 5 chars).");
      return;
    }
    setLoading(true);
    try {
      await api.createDispute({
        ride_id: rideId,
        category,
        description: description.trim(),
      });
      setDescription("");
      onSubmitted?.();
      onClose();
      Alert.alert(
        "Reported",
        "Thanks — our team will review this and get back to you."
      );
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%" }}
        >
          <View style={styles.sheet}>
            <View style={styles.grab} />
            <Text style={styles.title}>Report an issue</Text>
            <Text style={styles.sub}>
              Tell us what went wrong — our team will review within 24h.
            </Text>

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {categories.map((c) => {
                const active = category === c.key;
                return (
                  <Pressable
                    key={c.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(c.key)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>What happened?</Text>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue…"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.row}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                onPress={submit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Submit report</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  grab: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  sub: { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 14 },
  label: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  chipActive: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  chipText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  chipTextActive: { color: "#dc2626" },
  textarea: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#1e293b",
    minHeight: 100,
    marginBottom: 16,
  },
  row: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  cancelText: { color: "#475569", fontWeight: "600", fontSize: 14 },
  submitBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
