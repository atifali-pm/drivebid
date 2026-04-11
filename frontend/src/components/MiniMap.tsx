import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import { pickupIcon, dropoffIcon } from "../leaflet-setup";

interface Props {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
}

function FitBounds({
  points,
}: {
  points: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [20, 20] });
    }
  }, [map, points]);
  return null;
}

export default function MiniMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
}: Props) {
  const points: [number, number][] = [];
  if (pickupLat !== null && pickupLng !== null) points.push([pickupLat, pickupLng]);
  if (dropoffLat !== null && dropoffLng !== null)
    points.push([dropoffLat, dropoffLng]);

  if (points.length === 0) return null;

  return (
    <div className="h-40 w-full rounded-lg overflow-hidden border border-slate-200 mt-3">
      <MapContainer
        center={points[0]}
        zoom={13}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        doubleClickZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {pickupLat !== null && pickupLng !== null && (
          <Marker position={[pickupLat, pickupLng]} icon={pickupIcon} />
        )}
        {dropoffLat !== null && dropoffLng !== null && (
          <Marker position={[dropoffLat, dropoffLng]} icon={dropoffIcon} />
        )}
        {points.length === 2 && (
          <Polyline positions={points} color="#0ea5e9" weight={3} dashArray="6 6" />
        )}
      </MapContainer>
    </div>
  );
}
