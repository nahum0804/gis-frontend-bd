import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Pane, Popup } from 'react-leaflet';
import {
  lineString as turfLineString,
  nearestPointOnLine,
  length as turfLength,
  point as turfPoint,
  lineSlice
} from '@turf/turf';
import { getRoads, getVehicles, getStops, getETA } from '../api/transportApi';
import type { Vehicle, RoadFeatureCollection, Stop } from '../api/transportApi';

const POLL = 5000;
const THRESH = 120;

export default function MonitoringPanel() {
  const [roads, setRoads] = useState<RoadFeatureCollection | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const historyRef = useRef<Record<string, [number, number][]>>({});
  const [, tick] = useState(0);

  const [selVeh, setSelVeh] = useState<Vehicle | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [segmentPoint, setSegmentPoint] = useState<[number, number] | null>(null);
  const [toStopLine, setToStopLine] = useState<[number, number][]>([]);
  const [toStopDist, setToStopDist] = useState<number | null>(null);
  const [toStopSpeed, setToStopSpeed] = useState<number | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    getRoads().then(setRoads).catch(err => console.error('Error cargando rutas:', err));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserPos([coords.latitude, coords.longitude]),
      console.error,
      { enableHighAccuracy: true }
    );
    const poll = async () => {
      const vs = await getVehicles();
      setVehicles(vs);
      vs.forEach(v => {
        const hist = (historyRef.current[v.id] = historyRef.current[v.id] || []);
        hist.push([v.lat, v.lng]);
        if (hist.length > 20) hist.shift();
      });
      tick(n => n + 1);
    };
    poll();
    const id = setInterval(poll, POLL);
    return () => clearInterval(id);
  }, []);

  // On select vehicle: load stops, ETA, segmentPoint
  useEffect(() => {
    if (!selVeh) {
      setStops([]);
      setEtaMin(null);
      setSegmentPoint(null);
      return;
    }
    // Load stops and ETA
    getStops(selVeh.routeId).then(setStops).catch(() => setStops([]));
    getETA(selVeh.id).then(setEtaMin).catch(() => setEtaMin(null));
    // Compute snap point on route
    if (roads) {
      const feat = roads.features.find(f => f.properties.f1 === selVeh.routeId);
      if (feat) {
        const routeLine = turfLineString(feat.geometry.coordinates as [number, number][]);
        const vehPoint = turfPoint([selVeh.lng, selVeh.lat]);
        const snap = nearestPointOnLine(routeLine, vehPoint);
        const [lon, lat] = snap.geometry.coordinates as [number, number];
        setSegmentPoint([lat, lon]);
      }
    }
    setToStopLine([]);
    setToStopDist(null);
    setToStopSpeed(null);
  }, [selVeh, roads]);

  // Compute nearest stop along route from user's nearest stop, then distance along route to vehicle
  useEffect(() => {
    if (!selVeh || !userPos || stops.length === 0 || etaMin == null || !roads) return;
    const routeFeat = roads.features.find(f => f.properties.f1 === selVeh.routeId);
    if (!routeFeat) return;
    const routeLine = turfLineString(routeFeat.geometry.coordinates as [number, number][]);

    // Find nearest stop to user
    let nearestStop: Stop | null = null;
    let minUserDist = Infinity;
    stops.forEach(stop => {
      const stopPt = turfPoint([stop.coordinate[1], stop.coordinate[0]]);
      const userPt = turfPoint([userPos[1], userPos[0]]);
      const d = turfLength(lineSlice(userPt, stopPt, turfLineString([userPt.geometry.coordinates as [number, number], stopPt.geometry.coordinates as [number, number]])), { units: 'kilometers' });
      if (d < minUserDist) {
        minUserDist = d;
        nearestStop = stop;
      }
    });
    if (!nearestStop) return;

    // Snap both stops and vehicle to route
    const stopPt = turfPoint([nearestStop.coordinate[1], nearestStop.coordinate[0]]);
    const vehPt = turfPoint([selVeh.lng, selVeh.lat]);
    const snapStop = nearestPointOnLine(routeLine, stopPt);
    const snapVeh = nearestPointOnLine(routeLine, vehPt);

    // Slice along route between stop and vehicle
    const segment = lineSlice(snapStop, snapVeh, routeLine);
    const coords = (segment.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
    const dRoute = turfLength(segment, { units: 'kilometers' });

    setToStopLine(coords);
    setToStopDist(dRoute);
    setToStopSpeed(dRoute / (etaMin / 60));
  }, [stops, userPos, selVeh, etaMin, roads]);

  const delayed = (ts: string | null) => ts ? (Date.now() - new Date(ts).getTime()) / 1000 > THRESH : false;

  return (
    <div className="monitor-container">
      <MapContainer className="monitor-map" center={[10.342, -84.24]} zoom={12}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <Pane name="routes" style={{ zIndex: 200 }}>
          {roads?.features.map(f => (
            <Polyline key={f.properties.f1} positions={f.geometry.coordinates.map(c => [c[1], c[0]])} pathOptions={{ color: '#40E0D0', weight: 6, opacity: 0.8 }} />
          ))}
        </Pane>
        <Pane name="history" style={{ zIndex: 250 }}>
          {Object.entries(historyRef.current).map(([id, coords]) => (
            <Polyline key={id} positions={coords} pathOptions={{ color: '#888', weight: 3, opacity: 0.4 }} />
          ))}
        </Pane>
        <Pane name="segmentPoint" style={{ zIndex: 300 }}>
          {segmentPoint && <CircleMarker center={segmentPoint} radius={8} pathOptions={{ color: '#9C27B0', fillOpacity: 0.5 }} />}
        </Pane>
        <Pane name="vehicles" style={{ zIndex: 400 }}>
          {vehicles.map(v => (
            <CircleMarker key={v.id} center={[v.lat, v.lng]} radius={12}
              pathOptions={{ color: delayed(v.timestamp) ? '#D32F2F' : '#388E3C', fillColor: delayed(v.timestamp) ? '#F44336' : '#4CAF50', fillOpacity: 1 }}
              eventHandlers={{ click: () => setSelVeh(v) }}>
              <Popup><div><strong>{v.placa}</strong><br />Estado: {delayed(v.timestamp) ? 'Retrasado' : 'A tiempo'}</div></Popup>
            </CircleMarker>
          ))}
        </Pane>
        <Pane name="stops" style={{ zIndex: 350 }}>
          {selVeh && stops.map(stop => (
            <CircleMarker key={stop.id} center={stop.coordinate} radius={6}
              pathOptions={{ color: '#FFCF33', fillColor: '#FFEB3B', fillOpacity: 0.9 }}>
              <Popup>{stop.name}</Popup>
            </CircleMarker>
          ))}
        </Pane>
        <Pane name="toStop" style={{ zIndex: 375 }}>
          {toStopLine.length > 0 && <Polyline positions={toStopLine} pathOptions={{ color: '#0000FF', weight: 4, dashArray: '8,4', opacity: 0.9 }} />}
        </Pane>
        {userPos && <CircleMarker center={userPos} radius={8} pathOptions={{ color: '#1976D2', fillColor: '#1976D2', fillOpacity: 0.5 }} />}
      </MapContainer>
      {selVeh && (
        <div className="info-panel">
          <button className="close-btn" onClick={() => setSelVeh(null)}>×</button>
          <h2>Vehículo {selVeh.id}</h2>
          <p><strong>Ruta:</strong> {selVeh.routeId}</p>
          <p><strong>Estado:</strong> {delayed(selVeh.timestamp) ? 'Retrasado' : 'A tiempo'}</p>
          <p><strong>Distancia sobre ruta:</strong> {toStopDist?.toFixed(2)} km</p>
          <p><strong>Velocidad estimada:</strong> {toStopSpeed?.toFixed(2)} km/h</p>
          <p><strong>Tiempo ETA:</strong> {etaMin?.toFixed(0)} min</p>
        </div>
      )}
    </div>
  );
}
