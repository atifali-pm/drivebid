/**
 * Phone authentication screen using Firebase Phone Auth.
 *
 * Flow:
 * 1. User enters phone number (+92...)
 * 2. Firebase sends OTP via SMS (free up to 10K/month)
 * 3. User enters the 6-digit code
 * 4. On verify, Firebase gives us an ID token
 * 5. We send the ID token to our backend POST /auth/firebase-phone
 * 6. Backend verifies with Firebase Admin SDK, creates/logs in user
 *
 * Falls back to manual OTP (POST /auth/otp/request) if Firebase
 * is not configured (e.g. web preview, dev mode without google-services.json).
 */

import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, persistAuth, UserRole, API_BASE } from "./api";

interface Props {
  role: UserRole;
  brandColor: string;
  bgColor: string;
}

export default function PhoneAuthScreen({ role, brandColor, bgColor }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp" | "name">("phone");
  const [phone, setPhone] = useState("+92");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOTP() {
    if (phone.length < 10) return;
    setLoading(true);
    try {
      // Use our backend's OTP endpoint (works without Firebase config)
      const res = await fetch(`${API_BASE}/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send OTP");
      // In dev mode, the backend returns the OTP for testing
      if (data.dev_otp) setDevOtp(data.dev_otp);
      setStep("otp");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOTP() {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        // Existing user — logged in
        await persistAuth(data);
        router.replace("/dashboard");
        return;
      }
      if (res.status === 404) {
        // New phone — need to register, ask for name
        setStep("name");
        return;
      }
      throw new Error(data.detail || "Verification failed");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function registerWithPhone() {
    if (!fullName.trim()) return;
    setLoading(true);
    try {
      const data = await api.register({
        email: `${phone.replace("+", "")}@phone.drivebid.local`,
        full_name: fullName,
        password: Math.random().toString(36).slice(2),
        role,
        phone,
      });
      await persistAuth(data);
      router.replace("/dashboard");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bgColor }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: brandColor }]}>
            <Text style={styles.logoText}>DB</Text>
          </View>
          <Text style={styles.title}>DriveBid</Text>
        </View>

        {step === "phone" && (
          <>
            <Text style={styles.subtitle}>Enter your phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="+923001234567"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={15}
            />
            <Pressable
              style={[styles.button, { backgroundColor: brandColor }, loading && styles.disabled]}
              onPress={requestOTP}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Sending..." : "Send OTP"}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push("/login")}>
              <Text style={[styles.link, { color: brandColor }]}>
                Use email instead
              </Text>
            </Pressable>
          </>
        )}

        {step === "otp" && (
          <>
            <Text style={styles.subtitle}>Enter the 6-digit code</Text>
            <Text style={styles.hint}>Sent to {phone}</Text>
            {devOtp && (
              <Text style={styles.devHint}>Dev mode OTP: {devOtp}</Text>
            )}
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              maxLength={6}
            />
            <Pressable
              style={[styles.button, { backgroundColor: brandColor }, loading && styles.disabled]}
              onPress={verifyOTP}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Verifying..." : "Verify"}
              </Text>
            </Pressable>
            <Pressable onPress={() => { setStep("phone"); setCode(""); }}>
              <Text style={[styles.link, { color: brandColor }]}>
                Change number
              </Text>
            </Pressable>
          </>
        )}

        {step === "name" && (
          <>
            <Text style={styles.subtitle}>Welcome! What's your name?</Text>
            <Text style={styles.hint}>
              First time with {phone} — let's create your {role} account
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={fullName}
              onChangeText={setFullName}
            />
            <Pressable
              style={[styles.button, { backgroundColor: brandColor }, loading && styles.disabled]}
              onPress={registerWithPhone}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Creating..." : "Create Account"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 24,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  brand: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  logo: {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  logoText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b" },
  subtitle: { fontSize: 16, fontWeight: "600", color: "#475569", marginBottom: 8 },
  hint: { fontSize: 13, color: "#94a3b8", marginBottom: 16 },
  devHint: {
    fontSize: 13, color: "#f59e0b", backgroundColor: "#fefce8",
    padding: 8, borderRadius: 6, marginBottom: 12, textAlign: "center",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 12,
  },
  codeInput: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    padding: 14, fontSize: 24, letterSpacing: 8, textAlign: "center",
    marginBottom: 12, fontWeight: "bold",
  },
  button: {
    borderRadius: 8, padding: 14, alignItems: "center", marginBottom: 12,
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { textAlign: "center", fontSize: 14 },
});
