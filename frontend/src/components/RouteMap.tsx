import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { LocateFixed } from 'lucide-react';
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import type { TripPlan } from '../types';
import { clock, duration } from '../format';

const colors: Record<string, string> = {
  pickup: '#267967',
  dropoff: '#133c35',
  fuel: '#bd7422',
  rest: '#6b64a8',
  restart: '#6b64a8',
  break: '#6b64a8',
};
function MapController({
  plan,
  selected,
  fit,
}: {
  plan: TripPlan | null;
  selected: number | null;
  fit: number;
}) {
  const map = useMap();
  const initial = useRef(true);
  useEffect(() => {
    if (plan)
      map.fitBounds(plan.geometry.coordinates.map(([x, y]) => [y, x]) as LatLngBoundsExpression, {
        padding: [48, 48],
        maxZoom: 11,
      });
    else if (!initial.current) map.setView([38.2, -96.8], 4);
    initial.current = false;
  }, [map, plan, fit]);
  useEffect(() => {
    const event = plan?.events.find((e) => e.id === selected);
    if (event)
      map.flyTo([event.coordinates[1], event.coordinates[0]], Math.max(map.getZoom(), 7), {
        duration: 0.5,
      });
  }, [selected, plan, map]);
  return null;
}

export default function RouteMap({
  plan,
  selected,
  onSelect,
}: {
  plan: TripPlan | null;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const [fit, setFit] = useState(0);
  const [tileError, setTileError] = useState(false);
  const positions: LatLngTuple[] = plan?.geometry.coordinates.map(([x, y]) => [y, x]) || [];
  return (
    <div className="map-shell">
      <MapContainer
        center={[38.2, -96.8]}
        zoom={4}
        scrollWheelZoom={false}
        className="route-map"
        zoomControl
      >
        <TileLayer
          url={import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <MapController plan={plan} selected={selected} fit={fit} />
        {positions.length > 0 && (
          <>
            <Polyline positions={positions} pathOptions={{ color: '#fff', weight: 8 }} />
            <Polyline positions={positions} pathOptions={{ color: '#20715e', weight: 4 }} />
          </>
        )}
        {plan?.events
          .filter((e) => e.kind !== 'drive')
          .map((event) => (
            <CircleMarker
              key={event.id}
              center={[event.coordinates[1], event.coordinates[0]]}
              radius={selected === event.id ? 11 : 7}
              pathOptions={{
                color: 'white',
                weight: 3,
                fillColor: colors[event.kind],
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect(event.id) }}
            >
              <Tooltip>
                {event.kind === 'restart' ? '34-hour restart' : event.kind} ·{' '}
                {clock(event.start, plan.timezone)}
              </Tooltip>
              <Popup>
                <strong className="capitalize">{event.kind}</strong>
                <br />
                {event.location}
                <br />
                {duration(
                  (new Date(event.end).getTime() - new Date(event.start).getTime()) / 3_600_000,
                )}
                <br />
                {event.reason}
              </Popup>
            </CircleMarker>
          ))}
        {plan?.locations.map((location, index) => (
          <CircleMarker
            key={index}
            center={[location.coordinates[1], location.coordinates[0]]}
            radius={9}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#133c35', fillOpacity: 1 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]}>
              {['Start', 'Pickup', 'Delivery'][index]}
            </Tooltip>
            <Popup>{location.label}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-label">
        <span className="route-swatch" /> {plan ? 'Planned route' : 'Contiguous United States'}
      </div>
      <button
        className="map-fit"
        aria-label="Fit entire route"
        onClick={() => setFit((v) => v + 1)}
      >
        <LocateFixed size={18} />
      </button>
      {tileError && (
        <div className="map-error" role="status">
          Map tiles are unavailable. Your itinerary and logs remain accessible.
        </div>
      )}
      {plan && (
        <div className="map-legend">
          <span>
            <i style={{ background: '#133c35' }} /> Trip location
          </span>
          <span>
            <i style={{ background: '#bd7422' }} /> Fuel
          </span>
          <span>
            <i style={{ background: '#6b64a8' }} /> Rest / break
          </span>
        </div>
      )}
    </div>
  );
}
