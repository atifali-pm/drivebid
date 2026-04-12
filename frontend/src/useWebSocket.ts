import { useEffect, useRef } from "react";

const WS_BASE = "ws://drivebid.local:8050/ws";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const FALLBACK_POLL_MS = 30000;

export function useWebSocket(onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const token = localStorage.getItem("drivebid_token");
    if (!token) return;

    let ws: WebSocket | null = null;
    let reconnectDelay = RECONNECT_BASE_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      ws = new WebSocket(`${WS_BASE}?token=${token}`);

      ws.onopen = () => {
        reconnectDelay = RECONNECT_BASE_MS;
        if (fallbackTimer) clearInterval(fallbackTimer);
        fallbackTimer = setInterval(() => onRefreshRef.current(), FALLBACK_POLL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "refresh") {
            onRefreshRef.current();
          }
        } catch {
          /* ignore non-JSON */
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        if (fallbackTimer) clearInterval(fallbackTimer);
        fallbackTimer = setInterval(() => onRefreshRef.current(), FALLBACK_POLL_MS);
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
          connect();
        }, reconnectDelay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();
    onRefreshRef.current();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackTimer) clearInterval(fallbackTimer);
      ws?.close();
    };
  }, []);
}
