import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, API_BASE, Ride, getToken } from "../src/api";
import { formatMoney } from "../src/pricing";
import {
  LatLng,
  LeafletMap,
  LeafletMapHandle,
  LeafletMapMarker,
} from "../src/LeafletMap";

export default function RiderTripMap() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rideId?: string }>();
  const rideId = params.rideId ? Number(params.rideId) : null;

  const mapRef = useRef<LeafletMapHandle | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);

  // Poll ride state
  useEffect(() => {
    if (!rideId) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await api.getRide(rideId);
        if (!stop) setRide(r);
      } catch {
        /* ignore */
      } finally {
        if (!stop) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [rideId]);

  // Poll driver location (HTTP fallback)
  useEffect(() => {
    if (!rideId) return;
    let stop = false;
    const poll = async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API_BASE}/rides/${rideId}/driver-location`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!stop && data.lat != null && data.lng != null) {
          setDriverPos({ latitude: data.lat, longitude: data.lng });
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [rideId]);

  // WebSocket for real-time driver location
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
            if (
              msg.type === "driver_location" &&
              typeof msg.lat === "number" &&
              typeof msg.lng === "number"
            ) {
              setDriverPos({ latitude: msg.lat, longitude: msg.lng });
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
  }, []);

  const pickup: LatLng | null =
    ride?.pickup_lat != null && ride?.pickup_lng != null
      ? { latitude: ride.pickup_lat, longitude: ride.pickup_lng }
      : null;
  const dropoff: LatLng | null =
    ride?.dropoff_lat != null && ride?.dropoff_lng != null
      ? { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng }
      : null;

  // Auto-fit camera whenever positions change
  useEffect(() => {
    if (!mapRef.current) return;
    const pts: LatLng[] = [];
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    if (driverPos) pts.push(driverPos);
    if (pts.length >= 2) mapRef.current.fit(pts);
    else if (pts.length === 1) mapRef.current.center(pts[0], 14);
  }, [
    pickup?.latitude,
    dropoff?.latitude,
    driverPos?.latitude,
  ]);

  const acceptedBid = ride?.bids.find((b) => b.id === ride.accepted_bid_id);

  // Draggable sheet: 3 snap points (collapsed, half, expanded)
  const screenH = Dimensions.get("window").height;
  const SNAP_COLLAPSED = screenH * 0.18;
  const SNAP_HALF = screenH * 0.45;
  const SNAP_EXPANDED = screenH * 0.75;
  const sheetHeight = useRef(new Animated.Value(SNAP_HALF)).current;
  const lastSnap = useRef(SNAP_HALF);
  const dragStartY = useRef(0);

  function onGrabStart(e: any) {
    dragStartY.current = e.nativeEvent.pageY;
  }
  function onGrabMove(e: any) {
    const dy = e.nativeEvent.pageY - dragStartY.current;
    const newH = Math.max(
      SNAP_COLLAPSED,
      Math.min(SNAP_EXPANDED, lastSnap.current - dy)
    );
    sheetHeight.setValue(newH);
  }
  function onGrabEnd(e: any) {
    const dy = e.nativeEvent.pageY - dragStartY.current;
    const cur = lastSnap.current - dy;
    const snaps = [SNAP_COLLAPSED, SNAP_HALF, SNAP_EXPANDED];
    let closest = snaps[0];
    for (const s of snaps) {
      if (Math.abs(cur - s) < Math.abs(cur - closest)) closest = s;
    }
    lastSnap.current = closest;
    Animated.spring(sheetHeight, {
      toValue: closest,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }

  // Live distance from driver to pickup (or dropoff if trip started)
  const targetPos = ride?.status === "in_progress" ? dropoff : pickup;
  const liveDistKm =
    driverPos && targetPos
      ? haversineKm(driverPos, targetPos)
      : null;

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

  const vehicleIcon =
    acceptedBid?.driver_vehicle_type === "motorcycle" ? "🏍️"
    : acceptedBid?.driver_vehicle_type === "rickshaw" ? "🛺"
    : acceptedBid?.driver_vehicle_type === "van" ? "🚐"
    : "🚗";

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  const markers: LeafletMapMarker[] = [
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
    ...(driverPos
      ? [
          {
            id: "driver",
            latitude: driverPos.latitude,
            longitude: driverPos.longitude,
            color: "cyan",
            label: acceptedBid?.driver_name ?? "Driver",
            icon: vehicleIcon,
          },
        ]
      : []),
  ];
  const polyline = pickup && dropoff ? [pickup, dropoff] : undefined;
  const initialCenter = pickup ??
    driverPos ?? { latitude: 33.6844, longitude: 73.0479 };

  return (
    <View style={styles.container}>
      {/* Map takes remaining space above the sheet */}
      <View style={styles.mapArea}>
        <LeafletMap
          ref={mapRef}
          initialCenter={initialCenter}
          initialZoom={14}
          markers={markers}
          polyline={polyline}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <Text style={styles.iconTxt}>←</Text>
          </Pressable>
          <View style={styles.topChip}>
            <View
              style={[
                styles.topDot,
                {
                  backgroundColor:
                    ride?.status === "in_progress" ? "#f59e0b" : "#10b981",
                },
              ]}
            />
            <Text style={styles.topChipTxt}>
              {ride?.status === "in_progress" ? "Trip in progress" : "Driver en route"}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Draggable bottom sheet */}
      <Animated.View style={[styles.sheetWrap, { height: sheetHeight }]}>
        <View
          onTouchStart={onGrabStart}
          onTouchMove={onGrabMove}
          onTouchEnd={onGrabEnd}
          style={styles.grabArea}
        >
          <View style={styles.grab} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator
        >
        {acceptedBid && (
          <>
            {/* Driver identity */}
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{vehicleIcon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>
                  {acceptedBid.driver_name ?? "Driver"}
                </Text>
                <View style={styles.ratingRow}>
                  <Text style={styles.ratingText}>
                    {acceptedBid.driver_rating != null
                      ? `★ ${acceptedBid.driver_rating}`
                      : "★ New driver"}
                  </Text>
                  <Text style={styles.tripCount}>
                    {acceptedBid.driver_trip_count > 0
                      ? `${acceptedBid.driver_trip_count} trip${acceptedBid.driver_trip_count !== 1 ? "s" : ""}`
                      : "First trip"}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  style={styles.msgBtn}
                  onPress={() =>
                    router.push(
                      `/chat?rideId=${ride?.id}&otherName=${encodeURIComponent(acceptedBid.driver_name ?? "Driver")}`
                    )
                  }
                >
                  <Text style={styles.msgTxt}>Chat</Text>
                </Pressable>
                {acceptedBid.driver_phone && (
                  <Pressable
                    style={styles.callBtn}
                    onPress={() => Linking.openURL(`tel:${acceptedBid.driver_phone}`)}
                  >
                    <Text style={styles.callTxt}>Call</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Vehicle + fare info */}
            <View style={styles.infoGrid}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>FARE</Text>
                <Text style={styles.infoVal}>{formatMoney(acceptedBid.amount)}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>ETA</Text>
                <Text style={styles.infoVal}>{acceptedBid.eta_minutes} min</Text>
              </View>
              {liveDistKm != null && (
                <>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoCell}>
                    <Text style={styles.infoLabel}>AWAY</Text>
                    <Text style={[styles.infoVal, { color: "#06b6d4" }]}>
                      {liveDistKm.toFixed(1)} km
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Vehicle badge */}
            <View style={styles.vehicleBadge}>
              <Text style={styles.vehicleBadgeIcon}>{vehicleIcon}</Text>
              <Text style={styles.vehicleBadgeText}>
                {acceptedBid.driver_vehicle_model
                  ? `${acceptedBid.driver_vehicle_model}${acceptedBid.driver_vehicle_plate ? ` · ${acceptedBid.driver_vehicle_plate}` : ""}`
                  : "Vehicle details not set"}
              </Text>
            </View>

            {/* Route */}
            <View style={styles.routeLine}>
              <View style={styles.routeLeft}>
                <View style={[styles.routeDot, { backgroundColor: "#10b981" }]} />
                <View style={styles.routeBar} />
                <View style={[styles.routeDot, { backgroundColor: "#ef4444" }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeAddr}>{ride?.pickup}</Text>
                <View style={{ height: 22 }} />
                <Text style={styles.routeAddr}>{ride?.dropoff}</Text>
              </View>
            </View>
          </>
        )}
        {driverPos == null && (
          <Text style={styles.waitingText}>
            Waiting for driver to share location…
          </Text>
        )}
      </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e2e8f0" },
  center: { alignItems: "center", justifyContent: "center" },
  mapArea: { flex: 1 },
  topBar: {
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  iconTxt: { fontSize: 22, color: "#1e293b" },
  topChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    gap: 6,
  },
  topDot: { width: 8, height: 8, borderRadius: 4 },
  topChipTxt: { fontSize: 13, color: "#1e293b", fontWeight: "700" },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  grabArea: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  grab: {
    width: 50,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#94a3b8",
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#06b6d4",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  driverName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  ratingText: { fontSize: 12, color: "#f59e0b", fontWeight: "700" },
  tripCount: { fontSize: 11, color: "#94a3b8" },
  msgBtn: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  msgTxt: { color: "#1d4ed8", fontSize: 13, fontWeight: "700" },
  callBtn: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#6ee7b7",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callTxt: { color: "#047857", fontSize: 13, fontWeight: "700" },
  infoGrid: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  infoCell: { flex: 1, alignItems: "center" },
  infoDivider: { width: 1, backgroundColor: "#e2e8f0" },
  infoLabel: { fontSize: 10, color: "#64748b", fontWeight: "700", marginBottom: 4 },
  infoVal: { fontSize: 15, color: "#0f172a", fontWeight: "700" },
  vehicleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  vehicleBadgeIcon: { fontSize: 20 },
  vehicleBadgeText: { fontSize: 13, color: "#1e40af", fontWeight: "700" },
  routeLine: { flexDirection: "row", gap: 14, marginBottom: 6 },
  routeLeft: { alignItems: "center", width: 18, paddingTop: 4 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeBar: { width: 2, height: 30, backgroundColor: "#cbd5e1", marginVertical: 2 },
  routeAddr: { fontSize: 14, color: "#0f172a", fontWeight: "600" },
  waitingText: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 8,
  },
});
