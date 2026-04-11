import { KeyboardEvent, useCallback, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect } from "react";
import { pickupIcon, dropoffIcon } from "../leaflet-setup";

export type LatLng = { lat: number; lng: number };

export interface MapPickerValue {
  pickup: LatLng | null;
  dropoff: LatLng | null;
  pickupLabel: string;
  dropoffLabel: string;
}

interface Props {
  value: MapPickerValue;
  onChange: (v: MapPickerValue) => void;
}

const DEFAULT_CENTER: [number, number] = [33.6844, 73.0479]; // Islamabad

interface GeocodeResult {
  lat: number;
  lng: number;
  name: string;
  context: string;
  type: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
    osm_value?: string;
    osm_key?: string;
    type?: string;
  };
}

function formatPhotonResult(f: PhotonFeature): GeocodeResult {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;

  // Build a clean, human-readable name out of the structured fields.
  const primary =
    [p.housenumber, p.street].filter(Boolean).join(" ") ||
    p.name ||
    p.district ||
    p.city ||
    "Unnamed";

  const contextParts = [
    p.name && p.name !== primary ? p.name : null,
    p.district,
    p.city,
    p.state,
    p.country,
  ].filter((x): x is string => Boolean(x) && x !== primary);

  // Dedupe consecutive duplicates (district and city are often the same).
  const context: string[] = [];
  for (const part of contextParts) {
    if (context[context.length - 1] !== part) context.push(part);
  }

  const type = p.osm_value ?? p.osm_key ?? p.type ?? "place";

  return {
    lat,
    lng,
    name: primary,
    context: context.join(", "),
    type,
  };
}

async function geocode(
  query: string,
  bias: LatLng | null
): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    q: query,
    limit: "10",
    lang: "en",
  });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  const url = `https://photon.komoot.io/api/?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map(formatPhotonResult);
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    lang: "en",
  });
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?${params.toString()}`);
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = await res.json();
    const features = (data.features ?? []) as PhotonFeature[];
    if (features.length === 0) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const r = formatPhotonResult(features[0]);
    return r.context ? `${r.name}, ${r.context}` : r.name;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function ClickHandler({
  mode,
  onPick,
}: {
  mode: "pickup" | "dropoff";
  onPick: (mode: "pickup" | "dropoff", lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(mode, e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOn({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }
  }, [lat, lng, map]);
  return null;
}

function MapCenterTracker({ onMove }: { onMove: (c: LatLng) => void }) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      onMove({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

const TYPE_COLORS: Record<string, string> = {
  house: "bg-indigo-100 text-indigo-800",
  building: "bg-indigo-100 text-indigo-800",
  street: "bg-sky-100 text-sky-800",
  residential: "bg-sky-100 text-sky-800",
  secondary: "bg-sky-100 text-sky-800",
  primary: "bg-sky-100 text-sky-800",
  tertiary: "bg-sky-100 text-sky-800",
  suburb: "bg-amber-100 text-amber-800",
  neighbourhood: "bg-amber-100 text-amber-800",
  quarter: "bg-amber-100 text-amber-800",
  city: "bg-slate-200 text-slate-700",
  town: "bg-slate-200 text-slate-700",
  village: "bg-slate-200 text-slate-700",
  park: "bg-emerald-100 text-emerald-800",
  leisure: "bg-emerald-100 text-emerald-800",
};

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cls}`}>
      {type}
    </span>
  );
}

export default function MapPicker({ value, onChange }: Props) {
  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>({
    lat: DEFAULT_CENTER[0],
    lng: DEFAULT_CENTER[1],
  });

  const handlePick = useCallback(
    async (m: "pickup" | "dropoff", lat: number, lng: number) => {
      const label = await reverseGeocode(lat, lng);
      if (m === "pickup") {
        onChange({ ...value, pickup: { lat, lng }, pickupLabel: label });
      } else {
        onChange({ ...value, dropoff: { lat, lng }, dropoffLabel: label });
      }
      setFocus({ lat, lng });
    },
    [onChange, value]
  );

  async function runSearch() {
    setSearching(true);
    try {
      setResults(await geocode(search, mapCenter));
    } finally {
      setSearching(false);
    }
  }

  function handleSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  }

  function applyResult(r: GeocodeResult) {
    const label = r.context ? `${r.name}, ${r.context}` : r.name;
    if (mode === "pickup") {
      onChange({
        ...value,
        pickup: { lat: r.lat, lng: r.lng },
        pickupLabel: label,
      });
    } else {
      onChange({
        ...value,
        dropoff: { lat: r.lat, lng: r.lng },
        dropoffLabel: label,
      });
    }
    setFocus({ lat: r.lat, lng: r.lng });
    setResults([]);
    setSearch("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {(["pickup", "dropoff"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`text-xs px-3 py-1.5 rounded-md border font-medium capitalize ${
              mode === m
                ? m === "pickup"
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-red-500 text-white border-red-500"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            Set {m}
          </button>
        ))}
        <p className="text-xs text-slate-500 ml-auto">Click map or search</p>
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKey}
          placeholder="Search address, street, or landmark..."
          className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="text-sm bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md disabled:opacity-60"
        >
          {searching ? "..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="border border-slate-200 rounded-md max-h-60 overflow-y-auto bg-white divide-y divide-slate-100">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => applyResult(r)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {r.name}
                  </span>
                  <TypeBadge type={r.type} />
                </div>
                {r.context && (
                  <p className="text-xs text-slate-500 truncate">{r.context}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="h-64 w-full rounded-lg overflow-hidden border border-slate-200">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCenterTracker onMove={setMapCenter} />
          <ClickHandler mode={mode} onPick={handlePick} />
          {focus && <RecenterOn lat={focus.lat} lng={focus.lng} />}
          {value.pickup && (
            <Marker
              position={[value.pickup.lat, value.pickup.lng]}
              icon={pickupIcon}
            />
          )}
          {value.dropoff && (
            <Marker
              position={[value.dropoff.lat, value.dropoff.lng]}
              icon={dropoffIcon}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-[11px] text-slate-400">
        Tip: for street-level precision, search the sector first, then click
        the exact spot on the map.
      </p>

      <div className="text-xs space-y-1">
        <p>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
          Pickup:{" "}
          {value.pickupLabel || <em className="text-slate-400">not set</em>}
        </p>
        <p>
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
          Dropoff:{" "}
          {value.dropoffLabel || <em className="text-slate-400">not set</em>}
        </p>
      </div>
    </div>
  );
}
