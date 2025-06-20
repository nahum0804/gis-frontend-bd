import type { FeatureCollection, Geometry } from 'geojson';

export type RoadFeatureCollection = FeatureCollection<Geometry, { f1: number; f2: string }>;

export interface Vehicle { id: string; lat: number; lng: number; routeId: number; timestamp: string; }

export interface Stop { id: number; name: string; coordinate: [number, number]; }

const BASE = 'http://localhost:8000/api';

export async function getRoads(): Promise<RoadFeatureCollection> {
  const res = await fetch(`${BASE}/routes/`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<RoadFeatureCollection>;
}

export async function getVehicles(): Promise<Vehicle[]> {
  const res = await fetch(`${BASE}/vehicles/`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<Vehicle[]>;
}

export async function getETA(routeId: number, lat: number, lng: number): Promise<number> {
  const res = await fetch(`${BASE}/eta?routeId=${routeId}&lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(res.statusText);
  const { eta } = await res.json();
  return eta as number;
}


// utils/colors.ts
export const routeColors: Record<number, string> = {
  1: '#1abc9c', // verde aguamarina
  2: '#e67e22', // naranja
  3: '#3498db', // azul brillante
  // agrega más si tienes más rutas
};

export function getRouteColor(id: number): string {
  return routeColors[id] ?? '#ffb400'; // color por defecto amarillo
}

export async function getStops(routeId: number): Promise<Stop[]> {
  const res = await fetch(`${BASE}/routes/${routeId}/stops/`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<Stop[]>;
}
