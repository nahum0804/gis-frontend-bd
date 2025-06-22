import type { FeatureCollection, Geometry } from 'geojson';

export type RoadFeatureCollection = FeatureCollection<Geometry, { f1: number; f2: string }>;

export interface Vehicle {
  id: string;
  placa: string;
  tipo: string;
  estado: string;
  routeId: number;
  lat: number;
  lng: number;
  timestamp: string | null;
}

export interface Stop {
  id: number;
  name: string;
  coordinate: [number, number];
}

const BASE = 'http://127.0.0.1:8000/api';

// Rutas: convierte WKT a GeoJSON
export async function getRoads(): Promise<RoadFeatureCollection> {
  const res = await fetch(`${BASE}/rutas/`);
  if (!res.ok) throw new Error(res.statusText);
  const raw = (await res.json()) as Array<{ id_ruta: number; nombre: string; geom: string }>;
  const features = raw.map(item => {
    const wkt = item.geom.replace(/^SRID=\d+;/, '');
    const coordsText = wkt.match(/LINESTRING\s*\((.*)\)/)?.[1] || '';
    const coordinates = coordsText.split(',').map(pair => {
      const [lon, lat] = pair.trim().split(/\s+/).map(Number);
      return [lon, lat] as [number, number];
    });
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates },
      properties: { f1: item.id_ruta, f2: item.nombre }
    };
  });
  return { type: 'FeatureCollection', features };
}

// Vehículos: lista con última posición
export async function getVehicles(): Promise<Vehicle[]> {
  try {
    const res = await fetch(`${BASE}/vehiculos/`);
    if (!res.ok) throw new Error(res.statusText);
    const raw = (await res.json()) as Array<{ id: number; placa: string; tipo: string; estado: string; routeId: number; lat: number | null; lng: number | null; timestamp: string | null }>;
    return raw.map(v => ({
      id: v.id.toString(),
      placa: v.placa,
      tipo: v.tipo,
      estado: v.estado,
      routeId: v.routeId,
      lat: v.lat ?? 0,
      lng: v.lng ?? 0,
      timestamp: v.timestamp
    }));
  } catch (err) {
    console.error('Error en getVehicles():', err);
    return [];
  }
}

// Paradas: intenta sin slash y con slash, parsea WKT o GeoJSON
export async function getStops(routeId: number): Promise<Stop[]> {
  let res = await fetch(`${BASE}/rutas/${routeId}/paradas`);
  if (res.status === 404) {
    res = await fetch(`${BASE}/rutas/${routeId}/paradas/`);
  }
  if (!res.ok) {
    console.warn(`No se encontraron paradas para ruta ${routeId}:`, res.status);
    return [];
  }
  const raw = await res.json();
  // raw may be Array<{ id_parada?, id, nombre, geom: string|object }>
  return (raw as any[]).map(p => {
    let lat = 0, lon = 0;
    if (p.geom) {
      if (typeof p.geom === 'string') {
        // WKT: "SRID=4326;POINT(lon lat)"
        const wkt = p.geom.replace(/^SRID=\d+;/, '');
        const m = wkt.match(/POINT\s*\(\s*([\d.\-]+)\s+([\d.\-]+)\s*\)/);
        if (m) { lon = parseFloat(m[1]); lat = parseFloat(m[2]); }
      } else if (p.geom.coordinates) {
        lon = p.geom.coordinates[0]; lat = p.geom.coordinates[1];
      }
    }
    return {
      id: p.id_parada ?? p.id,
      name: p.nombre,
      coordinate: [lat, lon] as [number, number]
    };
  });
}

// Predicción: intenta sin slash y con slash
export async function getETA(vehicleId: string): Promise<number> {
  let res = await fetch(`${BASE}/vehiculos/${vehicleId}/prediccion`);
  if (res.status === 404) {
    res = await fetch(`${BASE}/vehiculos/${vehicleId}/prediccion/`);
  }
  if (!res.ok) throw new Error(res.statusText);
  const json = (await res.json()) as { eta_minutos: number };
  return json.eta_minutos;
}
