import type { FeatureCollection, Geometry } from 'geojson';

export type RoadFeatureCollection = FeatureCollection<Geometry, { f1: number; f2: string }>;

export interface Vehicle { id: string; lat: number; lng: number; routeId: number; timestamp: string; }

const BASE = 'http://localhost:8000/api';
export async function getRoads(): Promise<RoadFeatureCollection> {
  const res = await fetch(`${BASE}/vehicles/`);
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