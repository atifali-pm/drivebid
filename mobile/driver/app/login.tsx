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
import { useAuth } from "../src/useAuth";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      Alert.alert("Login failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>DB</Text>
          </View>
          <Text style={styles.title}>DriveBid</Text>
        </View>
        <Text style={styles.subtitle}>Driver Sign In</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign in"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push("/phone-auth")}>
          <Text style={styles.link}>Sign in with phone number</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/register")}>
          <Text style={[styles.link, { marginTop: 8 }]}>New driver? Create an account</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4", justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  brand: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  logo: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#10b981",
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  logoText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b" },
  subtitle: { fontSize: 16, fontWeight: "600", color: "#475569", marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 12,
  },
  button: {
    backgroundColor: "#10b981", borderRadius: 8,
    padding: 14, alignItems: "center", marginBottom: 12,
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { color: "#10b981", textAlign: "center", fontSize: 14 },
});
