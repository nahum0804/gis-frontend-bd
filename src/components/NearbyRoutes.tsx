import React, { useEffect, useState } from 'react';
import { getRoads } from '../api/transportApi';
import { isNearby } from '../utils/geo';
import type { RoadFeatureCollection } from '../api/transportApi';

interface RouteInfo { id: number; name: string; }

export default function NearbyRoutes({ onSelect }: { onSelect: (route: RouteInfo) => void }) {
  const [roads, setRoads] = useState<RoadFeatureCollection | null>(null);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [nearby, setNearby] = useState<RouteInfo[]>([]);
  useEffect(() => {
    getRoads().then(setRoads).catch(console.error);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPos([coords.latitude, coords.longitude]),
      console.error
    );
  }, []);
  useEffect(() => {
    if (!roads || !pos) return;
    const list = roads.features
      .filter(f => isNearby(f.geometry.coordinates, pos, 1))
      .map(f => ({ id: f.properties.f1, name: f.properties.f2 }));
    setNearby(list);
  }, [roads, pos]);
  if (!pos) return <p>Cargando ubicación...</p>;
  if (!roads) return <p>Cargando rutas...</p>;
  if (nearby.length === 0) return <p>No hay rutas cerca de ti.</p>;
  return (
    <div>
      <h3>Rutas cercanas</h3>
      <ul>
        {nearby.map(r => (
          <li key={r.id}>
            <button onClick={() => onSelect(r)}>{r.name}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}