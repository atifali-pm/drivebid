import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

// Vite/webpack break Leaflet's implicit icon resolution; reset with bundled URLs.
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
});

function coloredMarker(color: string): L.DivIcon {
  const html = `<div style="
    background:${color};
    width:18px;height:18px;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:2px solid white;
    box-shadow:0 1px 4px rgba(0,0,0,.4);
  "></div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 18],
  });
}

export const pickupIcon = coloredMarker("#10b981");
export const dropoffIcon = coloredMarker("#ef4444");
