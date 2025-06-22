import React, { useEffect, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  Pane
} from 'react-leaflet';
import {
  lineString as turfLineString,
  nearestPointOnLine,
  length as turfLength,
  point as turfPoint,
  lineSlice,
  distance as turfDistance,
  pointToLineDistance
} from '@turf/turf';
import { getRoads, getVehicles, getStops, getPrediction } from '../api/transportApi';
import type { Vehicle, RoadFeatureCollection, Stop } from '../api/transportApi';

const POLL = 5000;
const THRESH = 120;

interface VehicleInfo {
  vehicle: Vehicle;
  distance: number;
  lineCoords: [number, number][];
  eta?: number | null;
  speed?: number | null;
}

export default function MonitoringPanel() {
  const mapRef = useRef<any>(null);

  // Estados básicos
  const [roads, setRoads] = useState<RoadFeatureCollection | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [nearestRouteId, setNearestRouteId] = useState<number | null>(null);
  const [nearestStops, setNearestStops] = useState<Stop[]>([]);
  const [nearestStop, setNearestStop] = useState<Stop | null>(null);
  const [topVehicles, setTopVehicles] = useState<VehicleInfo[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  // Estado nuevo para selección/deselección
  const [selectedTopVehicleId, setSelectedTopVehicleId] = useState<string | null>(null);

  const historyRef = useRef<Record<string, [number, number][]>>({});
  const [, tick] = useState(0);

  const delayed = (ts: string | null) =>
    ts ? (Date.now() - new Date(ts).getTime()) / 1000 > THRESH : false;

  // 1) Carga inicial: rutas, posición y polling vehículos
  useEffect(() => {
    getRoads().then(data => setRoads(data)).catch(console.error);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserPos([coords.latitude, coords.longitude]),
      console.error,
      { enableHighAccuracy: true }
    );

    const poll = async () => {
      const vs = await getVehicles();
      console.group('🚍 Polling Vehículos');
      console.log('Lista completa de vehículos:', vs);
      console.groupEnd();
      setVehicles(vs);
      vs.forEach(v => {
        const arr = (historyRef.current[v.id] = historyRef.current[v.id] || []);
        arr.push([v.lat, v.lng]);
        if (arr.length > 20) arr.shift();
      });
      tick(n => n + 1);
    };

    poll();
    const id = setInterval(poll, POLL);
    return () => clearInterval(id);
  }, []);

  // 2) Cargar todas las paradas de todas las rutas
  useEffect(() => {
    if (!roads) return;
    Promise.all(
      roads.features.map(f => getStops(f.properties.f1).catch(() => []))
    ).then(arrays => setAllStops(arrays.flat()));
  }, [roads]);

  // 3) Ajustar vista para ver todos los vehículos
  useEffect(() => {
    if (mapRef.current && vehicles.length) {
      const bounds = vehicles.map(v => [v.lat, v.lng] as [number, number]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [vehicles]);

  // 4) Encontrar ruta y paradas más cercanas al usuario
  useEffect(() => {
    if (!roads || !userPos) return;
    const userPt = turfPoint([userPos[1], userPos[0]]);
    let bestId: number | null = null;
    let bestDist = Infinity;

    roads.features.forEach(f => {
      const line = turfLineString(f.geometry.coordinates as [number, number][]);
      const d = pointToLineDistance(userPt, line, { units: 'kilometers' });
      if (d < bestDist) {
        bestDist = d;
        bestId = f.properties.f1;
      }
    });
    if (bestId === null) return;
    setNearestRouteId(bestId);

    getStops(bestId)
      .then(stops => setNearestStops(stops))
      .catch(() => setNearestStops([]));
  }, [roads, userPos]);

  // 5) Calcular parada más cercana y top 3 vehículos
  useEffect(() => {
    if (
      !roads ||
      !userPos ||
      nearestRouteId === null ||
      vehicles.length === 0 ||
      nearestStops.length === 0
    ) {
      setNearestStop(null);
      setTopVehicles([]);
      return;
    }

    const userPt = turfPoint([userPos[1], userPos[0]]);
    // Parada más cercana
    let nearest = nearestStops[0];
    let minD = Infinity;
    for (const stop of nearestStops) {
      const stopPt = turfPoint([stop.coordinate[1], stop.coordinate[0]]);
      const d = turfDistance(userPt, stopPt, { units: 'kilometers' });
      if (d < minD) {
        minD = d;
        nearest = stop;
      }
    }
    setNearestStop(nearest);

    // Línea de ruta
    const feat = roads.features.find(f => f.properties.f1 === nearestRouteId)!;
    const routeLine = turfLineString(feat.geometry.coordinates as [number, number][]);

    // Generar VehicleInfo
    const infos: VehicleInfo[] = vehicles
      .filter(v => v.routeId === nearestRouteId)
      .map(v => {
        const snapStop = nearestPointOnLine(routeLine, turfPoint([nearest.coordinate[1], nearest.coordinate[0]]));
        const snapVeh = nearestPointOnLine(routeLine, turfPoint([v.lng, v.lat]));
        const seg = lineSlice(snapStop, snapVeh, routeLine);
        const dist = turfLength(seg, { units: 'kilometers' });
        const coords = (seg.geometry.coordinates as [number, number][]).map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );
        return { vehicle: v, distance: dist, lineCoords: coords };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    console.group('✨ Infos Top Vehículos (distancias y coords):');
    console.log(infos);
    console.groupEnd();

     Promise.all(
     infos.map(async info => {
       try {
         // Llamamos a prediccion completa
         const pred = await getPrediction(info.vehicle.id);
         // convertimos metros a km y minutos a horas
         const km  = pred.distancia_metros / 1000;
         const hrs = pred.eta_minutos    / 60;
         info.distance = km;                    // opcional: sobreescribes si prefieres
         info.eta      = pred.eta_minutos;
         info.speed    = hrs > 0 ? km / hrs : null;
       } catch {
         info.eta   = null;
         info.speed = null;
       }
       return info;
     })
   ).then(resolvedInfos => {
     console.group('✅ TopVehicles con prediccion y velocidad calculada:');
     console.log(resolvedInfos);
     console.groupEnd();
     setTopVehicles(resolvedInfos);
   });
  }, [roads, userPos, vehicles, nearestRouteId, nearestStops]);

  return (
    <div className="monitor-container">
      <MapContainer
        center={userPos || [10.342, -84.24]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        whenCreated={mapInstance => (mapRef.current = mapInstance)}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {/* RUTAS */}
        {roads?.features.map(f => (
          <Polyline
            key={f.properties.f1}
            positions={f.geometry.coordinates.map(c => [c[1], c[0]])}
            pathOptions={{
              color: f.properties.f1 === nearestRouteId ? '#40E0D0' : '#888',
              weight: f.properties.f1 === nearestRouteId ? 6 : 4,
              opacity: f.properties.f1 === nearestRouteId ? 0.8 : 0.4
            }}
          />
        ))}

        {/* TODAS LAS PARADAS */}
        {allStops.map(stop => (
          <CircleMarker
            key={stop.id}
            center={stop.coordinate}
            radius={4}
            pathOptions={{ color: '#FFF', fillColor: '#FFF', fillOpacity: 0.6 }}
          >
            <Popup>{stop.name}</Popup>
          </CircleMarker>
        ))}

        {/* PARADAS RUTA MÁS CERCANA */}
        {nearestStops.map(stop => (
          <CircleMarker
            key={`ns-${stop.id}`}
            center={stop.coordinate}
            radius={6}
            pathOptions={{ color: '#40E0D0', fillColor: '#40E0D0', fillOpacity: 0.8 }}
          />
        ))}

        {/* PARADA MÁS CERCANA */}
        {nearestStop && (
          <CircleMarker
            center={nearestStop.coordinate}
            radius={8}
            pathOptions={{ color: '#FFEB3B', fillColor: '#FFEB3B', fillOpacity: 1 }}
          >
            <Popup>Parada cercana: {nearestStop.name}</Popup>
          </CircleMarker>
        )}

        {/* TODOS LOS VEHÍCULOS (naranja) */}
        <Pane name="vehicles" style={{ zIndex: 600 }}>
          {vehicles.map(v => (
            <CircleMarker
              key={v.id}
              center={[v.lat, v.lng]}
              radius={8}
              pathOptions={{ color: '#FF5722', fillColor: '#FF5722', fillOpacity: 0.8 }}
            >
              <Popup><strong>Vehículo {v.id}</strong></Popup>
            </CircleMarker>
          ))}
        </Pane>

        {/* TOP 3 VEHÍCULOS (verde o dorado si está seleccionado) */}
        {topVehicles.map(info => {
          const isSelected = info.vehicle.id === selectedTopVehicleId;
          return (
            <React.Fragment key={info.vehicle.id}>
              <Polyline
                positions={info.lineCoords}
                pathOptions={{
                  color: isSelected ? '#FFD700' : '#4CAF50',
                  weight: isSelected ? 6 : 4,
                  dashArray: '8,4',
                  opacity: 0.9
                }}
              />
              <CircleMarker
                center={[info.vehicle.lat, info.vehicle.lng]}
                radius={isSelected ? 14 : 10}
                pathOptions={{
                  color: isSelected ? '#FFD700' : '#4CAF50',
                  fillColor: isSelected ? '#FFD700' : '#4CAF50',
                  fillOpacity: 1
                }}
              >
                <Popup>
                  <div>
                    <strong>Vehículo {info.vehicle.id}</strong><br/>
                    Dist: {info.distance.toFixed(2)} km<br/>
                    Vel: {info.speed?.toFixed(2)} km/h<br/>
                    ETA: {info.eta?.toFixed(0)} min
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {/* TU UBICACIÓN */}
        {userPos && (
          <CircleMarker
            center={userPos}
            radius={8}
            pathOptions={{ color: '#1976D2', fillColor: '#1976D2', fillOpacity: 0.8 }}
          >
            <Popup>Tu ubicación</Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {/* PANEL DE SELECCIÓN */}
      <div className="info-panel" style={{ backgroundColor: '#1e1e1e', padding: '1rem', color: '#fff' }}>
        <h2 style={{ color: '#fff' }}>Vehículos más cercanos a tu parada</h2>

        {topVehicles.length === 0 ? (
          <p style={{ color: '#ccc' }}>No hay vehículos para la ruta seleccionada.</p>
        ) : (
          topVehicles.map(info => {
            const isSelected = info.vehicle.id === selectedTopVehicleId;
            return (
              <div
                key={info.vehicle.id}
                onClick={() =>
                  setSelectedTopVehicleId(prev =>
                    prev === info.vehicle.id ? null : info.vehicle.id
                  )
                }
                style={{
                  marginBottom: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: isSelected ? '#2a2a2a' : '#333',
                  color: '#fff',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #555' : '1px solid #444',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
              >
                <strong style={{ color: '#fff' }}>Vehículo {info.vehicle.id}</strong><br/>
                <span style={{ color: '#ddd' }}>
                  Distancia: {info.distance.toFixed(2)} km<br/>
                  Velocidad: {info.speed?.toFixed(2) ?? '–'} km/h<br/>
                  ETA: {info.eta?.toFixed(0) ?? '–'} min
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
