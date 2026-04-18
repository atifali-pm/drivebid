import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, API_BASE, Ride, getToken } from "../src/api";
import { formatMoney } from "../src/pricing";
import { DisputeModal } from "../src/DisputeModal";
import { startBackgroundLocation, stopBackgroundLocation } from "../src/backgroundLocation";
import {
  LatLng,
  LeafletMap,
  LeafletMapHandle,
  LeafletMapMarker,
} from "../src/LeafletMap";

export default function DriverTripMap() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rideId?: string }>();
  const rideId = params.rideId ? Number(params.rideId) : null;

  const mapRef = useRef<LeafletMapHandle | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [here, setHere] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);

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

  // Start background location tracking when screen mounts (survives minimize)
  useEffect(() => {
    if (!rideId) return;
    startBackgroundLocation(rideId).catch(() => { /* ignore — fg fallback */ });
    return () => {
      stopBackgroundLocation().catch(() => { /* ignore */ });
    };
  }, [rideId]);

  useEffect(() => {
    if (!rideId) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location required",
          "The driver app needs location access to share your position with the rider during a trip."
        );
        return;
      }
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        async (pos) => {
          const coord = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setHere(coord);
          try {
            const token = await getToken();
            const res = await fetch(
              `${API_BASE}/rides/${rideId}/driver-location?lat=${coord.latitude}&lng=${coord.longitude}`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (!res.ok) setSendError(`HTTP ${res.status}`);
            else setSendError(null);
          } catch (e) {
            setSendError(e instanceof Error ? e.message : "network");
          }
        }
      );
    })();
    return () => {
      sub?.remove();
    };
  }, [rideId]);

  const pickup: LatLng | null =
    ride?.pickup_lat != null && ride?.pickup_lng != null
      ? { latitude: ride.pickup_lat, longitude: ride.pickup_lng }
      : null;
  const dropoff: LatLng | null =
    ride?.dropoff_lat != null && ride?.dropoff_lng != null
      ? { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng }
      : null;

  useEffect(() => {
    if (!mapRef.current) return;
    const pts: LatLng[] = [];
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    if (here) pts.push(here);
    if (pts.length >= 2) mapRef.current.fit(pts);
    else if (pts.length === 1) mapRef.current.center(pts[0], 14);
  }, [pickup?.latitude, dropoff?.latitude, here?.latitude]);

  async function start() {
    if (!rideId) return;
    setActing(true);
    try {
      const r = await api.startRide(rideId);
      setRide(r);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      setActing(false);
    }
  }

  async function complete() {
    if (!rideId || !ride) return;
    const acceptedBid = ride.bids.find((b) => b.id === ride.accepted_bid_id);
    const amount = acceptedBid?.amount ?? 0;
    // Confirm cash collection before marking trip complete
    Alert.alert(
      "Confirm payment",
      `Have you collected ${formatMoney(amount)} cash from the rider?`,
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Yes, collected",
          style: "default",
          onPress: async () => {
            setActing(true);
            try {
              const r = await api.completeRide(rideId);
              setRide(r);
              Alert.alert(
                "Trip complete",
                `${formatMoney(amount)} collected. Thanks for driving!`,
                [{ text: "OK", onPress: () => router.back() }]
              );
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed"
              );
            } finally {
              setActing(false);
            }
          },
        },
      ]
    );
  }

  async function cancelTrip() {
    if (!rideId) return;
    Alert.alert(
      "Cancel trip?",
      "The rider will be notified and the ride will reopen for bidding.",
      [
        { text: "Keep trip", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: async () => {
            setActing(true);
            try {
              await api.cancelRide(rideId);
              router.back();
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed"
              );
            } finally {
              setActing(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#10b981" />
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
    ...(here
      ? [
          {
            id: "me",
            latitude: here.latitude,
            longitude: here.longitude,
            color: "cyan",
            label: "You",
          },
        ]
      : []),
  ];
  const polyline = pickup && dropoff ? [pickup, dropoff] : undefined;
  const initialCenter = here ??
    pickup ?? { latitude: 33.6844, longitude: 73.0479 };

  const statusLabel =
    ride?.status === "in_progress"
      ? "Trip in progress"
      : ride?.status === "accepted"
      ? "En route to pickup"
      : ride?.status ?? "";

  return (
    <View style={styles.container}>
      {/* Map takes remaining space */}
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
            <View style={styles.topDot} />
            <Text style={styles.topChipTxt}>{statusLabel}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        {sendError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Location send: {sendError}</Text>
          </View>
        )}
      </View>

      {/* Sheet as flex sibling */}
      <View style={styles.sheetWrap}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
        showsVerticalScrollIndicator
      >
        <View style={styles.riderRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>
              {(ride?.rider_name ?? "R")
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{ride?.rider_name ?? "Rider"}</Text>
            <Text style={styles.riderMeta}>
              Max {formatMoney(ride?.max_budget ?? 0)}
            </Text>
          </View>
          <Pressable
            style={styles.chatBtn}
            onPress={() =>
              router.push(
                `/chat?rideId=${ride?.id}&otherName=${encodeURIComponent(ride?.rider_name ?? "Rider")}`
              )
            }
          >
            <Text style={styles.chatTxt}>Chat</Text>
          </Pressable>
        </View>

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

        {ride?.status === "accepted" && (
          <>
            <Pressable
              style={[styles.actionBtn, acting && { opacity: 0.6 }]}
              onPress={start}
              disabled={acting}
            >
              <Text style={styles.actionBtnText}>Start trip</Text>
            </Pressable>
            <View style={styles.secondaryRow}>
              <Pressable
                style={styles.cancelBtn}
                onPress={cancelTrip}
                disabled={acting}
              >
                <Text style={styles.cancelText}>Cancel trip</Text>
              </Pressable>
              <Pressable
                style={styles.reportBtn}
                onPress={() => setDisputeOpen(true)}
                disabled={acting}
              >
                <Text style={styles.reportText}>Report issue</Text>
              </Pressable>
            </View>
          </>
        )}
        {ride?.status === "in_progress" && (
          <>
            <Pressable
              style={[styles.actionBtn, acting && { opacity: 0.6 }]}
              onPress={complete}
              disabled={acting}
            >
              <Text style={styles.actionBtnText}>Complete trip</Text>
            </Pressable>
            <Pressable
              style={[styles.reportBtn, { marginTop: 8 }]}
              onPress={() => setDisputeOpen(true)}
              disabled={acting}
            >
              <Text style={styles.reportText}>Report issue</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      </View>

      {rideId && (
        <DisputeModal
          visible={disputeOpen}
          rideId={rideId}
          role="driver"
          onClose={() => setDisputeOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e2e8f0" },
  center: { alignItems: "center", justifyContent: "center" },
  mapArea: { flex: 55 },
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
  topDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10b981" },
  topChipTxt: { fontSize: 13, color: "#1e293b", fontWeight: "700" },
  errorBanner: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(239,68,68,0.92)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  errorText: {
    color: "#fff",
    fontSize: 11,
    textAlign: "center",
    fontWeight: "600",
  },
  sheetWrap: {
    flex: 45,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  grab: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 14,
  },
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  riderName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  riderMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  chatBtn: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chatTxt: { color: "#1d4ed8", fontSize: 13, fontWeight: "700" },
  routeLine: { flexDirection: "row", gap: 14, marginBottom: 16 },
  routeLeft: { alignItems: "center", width: 18, paddingTop: 4 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeBar: { width: 2, height: 30, backgroundColor: "#cbd5e1", marginVertical: 2 },
  routeAddr: { fontSize: 14, color: "#0f172a", fontWeight: "600" },
  actionBtn: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  cancelText: { color: "#b91c1c", fontWeight: "600", fontSize: 13 },
  reportBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  reportText: { color: "#475569", fontWeight: "600", fontSize: 13 },
});
