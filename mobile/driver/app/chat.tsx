import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, API_BASE, getToken, getStoredUser } from "../src/api";

interface ChatMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  msg_type: string;
  created_at: string;
}

export default function Chat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rideId?: string; otherName?: string }>();
  const rideId = params.rideId ? Number(params.rideId) : null;
  const otherName = params.otherName ?? "Chat";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState<number | null>(null);
  const flatRef = useRef<FlatList<ChatMessage> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Get my user id
  useEffect(() => {
    getStoredUser().then((u) => setMyId(u?.id ?? null));
  }, []);

  // Poll messages
  const loadMessages = useCallback(async () => {
    if (!rideId) return;
    try {
      const msgs = await api.listMessages(rideId);
      setMessages(msgs);
    } catch {
      /* ignore */
    }
  }, [rideId]);

  useEffect(() => {
    loadMessages();
    const t = setInterval(loadMessages, 3000);
    return () => clearInterval(t);
  }, [loadMessages]);

  // WebSocket for real-time
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      const wsUrl = API_BASE.replace(/^http/, "ws") + `/ws?token=${token}`;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "message" && msg.ride_id === rideId) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [
                  ...prev,
                  {
                    id: msg.id ?? Date.now(),
                    sender_id: msg.sender_id,
                    sender_name: msg.sender_name,
                    content: msg.content,
                    msg_type: msg.msg_type ?? "text",
                    created_at: msg.created_at,
                  },
                ];
              });
            }
          } catch {
            /* ignore */
          }
        };
      } catch {
        /* ignore */
      }
    })();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [rideId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  async function send() {
    if (!rideId || !text.trim()) return;
    setSending(true);
    try {
      await api.sendMessage(rideId, text.trim());
      setText("");
      loadMessages();
    } catch (err) {
      Alert.alert("Send failed", err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{otherName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.msgList}
        renderItem={({ item }) => {
          const isMe = item.sender_id === myId;
          return (
            <View
              style={[
                styles.bubble,
                isMe ? styles.bubbleMe : styles.bubbleThem,
              ]}
            >
              {!isMe && (
                <Text style={styles.senderName}>{item.sender_name}</Text>
              )}
              <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
                {item.content}
              </Text>
              <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No messages yet. Say hello!
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          multiline
          maxLength={500}
        />
        <Pressable
          style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
          onPress={send}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendTxt}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  backTxt: { fontSize: 22, color: "#1e293b" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  msgList: { padding: 16, paddingBottom: 8 },
  bubble: {
    maxWidth: "78%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: "#06b6d4",
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  senderName: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 4,
  },
  msgText: { fontSize: 15, color: "#0f172a", lineHeight: 20 },
  msgTextMe: { color: "#fff" },
  msgTime: { fontSize: 10, color: "#94a3b8", marginTop: 4, textAlign: "right" },
  msgTimeMe: { color: "rgba(255,255,255,0.7)" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: { color: "#94a3b8", fontSize: 14, fontStyle: "italic" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 40,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  sendBtn: {
    backgroundColor: "#06b6d4",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
