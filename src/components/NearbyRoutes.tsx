import React, { useEffect, useState } from 'react';
import { getRoads } from '../api/transportApi';
import { isNearby } from '../utils/geo';
import type { RoadFeatureCollection } from '../api/transportApi';

interface RouteInfo { id: number; name: string; }

export default function NearbyRoutes({ onSelect }: { onSelect: (route: RouteInfo) => void }) {
  const [roads, setRoads] = useState<RoadFeatureCollection | null>(null);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [nearby, setNearby] = useState<RouteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 1) Carga de rutas y manejo de errores
  useEffect(() => {
    getRoads()
      .then(r => {
        setRoads(r);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
        setError(true);
      });

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPos([coords.latitude, coords.longitude]),
      err => {
        console.error(err);
        setPos(null);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // 2) Filtrado de rutas cercanas cuando ya tengamos rutas y posición
  useEffect(() => {
    if (!roads || !pos) return;
    const list = roads.features
      .filter(f => isNearby(f.geometry.coordinates, pos, 1))
      .map(f => ({ id: f.properties.f1, name: f.properties.f2 }));
    setNearby(list);
  }, [roads, pos]);

  // 3) Renderizado según estado
  if (!pos) {
    return <p>Cargando ubicación...</p>;
  }

  if (loading) {
    return <p>Cargando rutas...</p>;
  }

  if (error) {
    return <p>Error al cargar rutas. Intenta recargar la página.</p>;
  }

  if (nearby.length === 0) {
    return <p>No se encontraron rutas cerca de ti.</p>;
  }

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