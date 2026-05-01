import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useGeolocation } from '../hooks/useGeolocation';

const defaultCenter = { latitude: 20.5937, longitude: 78.9629, address: 'India', source: 'manual' };

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MapClickHandler = ({ onPick }) => {
  useMapEvents({
    click: (event) => {
      onPick({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        source: 'manual',
      });
    },
  });
  return null;
};

const MapRecenter = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 13));
  }, [center, map]);

  return null;
};

const LocationPicker = ({ value, onChange }) => {
  const { getCurrentLocation, loading, error: geolocationError } = useGeolocation();
  const [query, setQuery] = useState(value?.address || '');
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const lastSyncedAddress = useRef(value?.address || '');
  const userEdited = useRef(false);

  const resolvedValue = value || defaultCenter;

  useEffect(() => {
    const nextAddress = value?.address || '';
    if (nextAddress !== lastSyncedAddress.current && !userEdited.current) {
      setQuery(nextAddress);
    }
    lastSyncedAddress.current = nextAddress;
    userEdited.current = false;
  }, [value]);

  const mapCenter = useMemo(
    () => [resolvedValue.latitude, resolvedValue.longitude],
    [resolvedValue.latitude, resolvedValue.longitude]
  );

  const reverseGeocode = async ({ latitude, longitude }) => {
    let address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      if (response.ok) {
        const data = await response.json();
        address = data.display_name || address;
      }
    } catch {
      // ignore
    }
    onChange({ latitude, longitude, address, source: 'manual' });
  };

  const handleUseCurrent = async () => {
    setNotice('');
    const location = await getCurrentLocation({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
      watchForAccuracy: true,
      desiredAccuracy: 200,
      maxAcceptableAccuracy: 5000,
      watchTimeout: 20000,
    });
    if (location) {
      onChange(location);
    } else {
      setNotice(geolocationError || 'Could not get an accurate browser location. Search your area or click the map instead.');
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setNotice('');
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const results = await response.json();
        if (results?.length) {
          const top = results[0];
          onChange({
            latitude: Number(top.lat),
            longitude: Number(top.lon),
            address: top.display_name || query,
            source: 'manual',
          });
        } else {
          setNotice('No matching place found. Try a more specific area, city, or PIN code.');
        }
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(event) => {
            userEdited.current = true;
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSearch();
            }
          }}
          placeholder="Enter city or address"
          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400"
          disabled={searching}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
        <button
          type="button"
          onClick={handleUseCurrent}
          className="rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow shadow-brand-primary/40 hover:bg-brand-secondary"
          disabled={loading}
        >
          {loading ? 'Locating…' : 'Use Current'}
        </button>
      </div>
      {(notice || geolocationError) && (
        <p className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {notice || geolocationError}
        </p>
      )}

      <div className="h-64 w-full overflow-hidden rounded-xl border border-slate-800">
        <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
          <MapRecenter center={mapCenter} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler
            onPick={(coords) => {
              reverseGeocode(coords);
            }}
          />
          <Marker position={mapCenter} icon={markerIcon} />
        </MapContainer>
      </div>

      {value && (
        <div className="rounded border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
          <p>
            <span className="font-semibold">Coordinates:</span> {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
          </p>
          {Number.isFinite(value.accuracy) && (
            <p className="mt-1">
              <span className="font-semibold">Browser accuracy:</span> approximately {Math.round(value.accuracy)} m
            </p>
          )}
          {value.address && (
            <p className="mt-1">
              <span className="font-semibold">Address:</span> {value.address}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
