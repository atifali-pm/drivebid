import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LeafletMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  color?: string;
  label?: string;
  /** Emoji or short text to render inside the marker (e.g. "🚗", "🏍️") */
  icon?: string;
}

export interface LeafletMapHandle {
  /** Fit the map to the given points (adds padding). */
  fit: (points: LatLng[]) => void;
  /** Center on a single point with a zoom level. */
  center: (point: LatLng, zoom?: number) => void;
}

interface LeafletMapProps {
  initialCenter?: LatLng;
  initialZoom?: number;
  markers?: LeafletMapMarker[];
  polyline?: LatLng[];
  tappable?: boolean;
  onMapTap?: (point: LatLng) => void;
  style?: ViewStyle;
}

const ISLAMABAD: LatLng = { latitude: 33.6844, longitude: 73.0479 };

function buildHtml(center: LatLng, zoom: number, tappable: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
  body { background: #e2e8f0; font-family: system-ui, sans-serif; }
  .leaflet-control-attribution { font-size: 9px !important; }
  .pin-green, .pin-red, .pin-cyan {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 4px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  }
  .pin-green { background: #10b981; }
  .pin-red { background: #ef4444; }
  .pin-cyan {
    background: #06b6d4;
    animation: pulse 1.2s infinite;
  }
  .pin-icon {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid #06b6d4;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    animation: pulse 1.2s infinite;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(6,182,212,0.5), 0 2px 6px rgba(0,0,0,0.35); }
    70% { box-shadow: 0 0 0 14px rgba(6,182,212,0), 0 2px 6px rgba(0,0,0,0.35); }
    100% { box-shadow: 0 0 0 0 rgba(6,182,212,0), 0 2px 6px rgba(0,0,0,0.35); }
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: true })
    .setView([${center.latitude}, ${center.longitude}], ${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OSM'
  }).addTo(map);

  var markers = {};
  var polyline = null;

  function post(msg) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(JSON.stringify(msg), '*');
      }
    } catch (e) { /* ignore */ }
  }

  function makeIcon(color, iconEmoji) {
    if (iconEmoji) {
      return L.divIcon({
        className: '',
        html: '<div class="pin-icon">' + iconEmoji + '</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
    }
    var cls = color === 'green' ? 'pin-green'
            : color === 'red' ? 'pin-red'
            : 'pin-cyan';
    return L.divIcon({
      className: '',
      html: '<div class="' + cls + '"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  function setMarker(m) {
    if (markers[m.id]) {
      markers[m.id].setLatLng([m.latitude, m.longitude]);
      markers[m.id].setIcon(makeIcon(m.color || 'cyan', m.icon));
    } else {
      markers[m.id] = L.marker(
        [m.latitude, m.longitude],
        { icon: makeIcon(m.color || 'cyan', m.icon), title: m.label || '' }
      ).addTo(map);
    }
  }

  function clearMarkers() {
    Object.keys(markers).forEach(function (k) {
      map.removeLayer(markers[k]);
    });
    markers = {};
  }

  function setPolyline(points) {
    if (polyline) { map.removeLayer(polyline); polyline = null; }
    if (points && points.length >= 2) {
      var latlngs = points.map(function (p) { return [p.latitude, p.longitude]; });
      polyline = L.polyline(latlngs, { color: '#06b6d4', weight: 5, opacity: 0.9 }).addTo(map);
    }
  }

  function fit(points) {
    if (!points || !points.length) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15);
      return;
    }
    var bounds = L.latLngBounds(points.map(function (p) {
      return [p.latitude, p.longitude];
    }));
    map.fitBounds(bounds, { padding: [60, 60] });
  }

  function center(point, zoom) {
    map.setView([point.latitude, point.longitude], zoom || map.getZoom());
  }

  ${tappable ? `
  map.on('click', function (e) {
    post({ type: 'tap', lat: e.latlng.lat, lng: e.latlng.lng });
  });` : ''}

  window.__applyCommand = function (cmd) {
    try {
      if (cmd.type === 'markers') {
        clearMarkers();
        (cmd.markers || []).forEach(setMarker);
      } else if (cmd.type === 'polyline') {
        setPolyline(cmd.points || []);
      } else if (cmd.type === 'fit') {
        fit(cmd.points || []);
      } else if (cmd.type === 'center') {
        center(cmd.point, cmd.zoom);
      }
    } catch (e) { /* ignore */ }
  };

  // Listen for commands from parent (web iframe) or native (injected JS)
  window.addEventListener('message', function (e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && data.type) window.__applyCommand(data);
    } catch (err) { /* ignore */ }
  });

  post({ type: 'ready' });
</script>
</body>
</html>`;
}

export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap(
  {
    initialCenter = ISLAMABAD,
    initialZoom = 13,
    markers = [],
    polyline,
    tappable = false,
    onMapTap,
    style,
  },
  ref
) {
  const webRef = useRef<WebView | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<object[]>([]);

  const html = useMemo(
    () => buildHtml(initialCenter, initialZoom, tappable),
    [initialCenter.latitude, initialCenter.longitude, initialZoom, tappable]
  );

  function send(cmd: object) {
    const js = `window.__applyCommand && window.__applyCommand(${JSON.stringify(cmd)}); true;`;
    if (readyRef.current && webRef.current) {
      webRef.current.injectJavaScript(js);
    } else {
      pendingRef.current.push(cmd);
    }
  }

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") {
        readyRef.current = true;
        // Flush any queued commands + apply initial state
        pendingRef.current.forEach(send);
        pendingRef.current = [];
        send({ type: "markers", markers });
        if (polyline && polyline.length >= 2) {
          send({
            type: "polyline",
            points: polyline.map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            })),
          });
        }
      } else if (msg.type === "tap" && onMapTap) {
        onMapTap({ latitude: msg.lat, longitude: msg.lng });
      }
    } catch {
      /* ignore */
    }
  }

  // Apply reactive updates whenever markers/polyline change
  useImperativeHandle(ref, () => ({
    fit: (points) => send({ type: "fit", points }),
    center: (point, zoom) => send({ type: "center", point, zoom }),
  }));

  // Push marker/polyline updates whenever they change
  useEffect(() => {
    send({ type: "markers", markers });
  }, [JSON.stringify(markers)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (polyline) send({ type: "polyline", points: polyline });
  }, [JSON.stringify(polyline)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e2e8f0", overflow: "hidden" },
});
