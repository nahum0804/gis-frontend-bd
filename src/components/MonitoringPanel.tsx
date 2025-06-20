import { useEffect, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Pane
} from 'react-leaflet';
import { getRoads, getVehicles, getETA } from '../api/transportApi';
import type { Vehicle, RoadFeatureCollection } from '../api/transportApi';
import {
  lineString as turfLineString,
  nearestPointOnLine,
  lineSlice,
  length as turfLength,
  point as turfPoint
} from '@turf/turf';


interface Stop { id: number; name: string; coordinate: [number, number]; }
const stopsByRoute: Record<number, Stop[]> = {
  1: [
    { id: 1, name: 'Quesada', coordinate: [-84.432539, 10.341727] },
    { id: 2, name: 'Florencia', coordinate: [-84.476857, 10.360427] },
    { id: 3, name: 'Aguas Zarcas', coordinate: [-84.515559, 10.357257] }
  ],
  2: [
    { id: 1, name: 'Quesada', coordinate: [-84.423900, 10.325447] },
    { id: 2, name: 'Aguas Zarcas', coordinate: [-84.340405, 10.374535] },
    { id: 3, name: 'Pital', coordinate: [-84.274162, 10.453038] }
  ]
};

const POLL = 5000, THRESH = 120;

export default function MonitoringPanel() {
  const [roads, setRoads] = useState<RoadFeatureCollection|null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const historyRef = useRef<Record<string,[number,number][]>>({});
  const [, tick] = useState(0);

  const [selVeh, setSelVeh] = useState<Vehicle|null>(null);
  const [segment, setSegment] = useState<[number,number][]>([]);
  const [distKm, setDistKm] = useState<number|null>(null);
  const [etaMin, setEtaMin] = useState<number|null>(null);

  useEffect(()=>{
    getRoads().then(setRoads);
    const poll = async ()=>{
      const vs = await getVehicles();
      setVehicles(vs);
      vs.forEach(v=>{
        const h = historyRef.current[v.id] = historyRef.current[v.id]||[];
        h.push([v.lat,v.lng]);
        if(h.length>20) h.shift();
      });
      tick(n=>n+1);
    };
    poll();
    const id = setInterval(poll,POLL);
    return ()=>clearInterval(id);
  },[]);

  const delayed = (ts:string)=>(Date.now()-new Date(ts).getTime())/1000>THRESH;

  const onSelect = async (v:Vehicle) => {
    setSelVeh(v);
    setSegment([]); setDistKm(null); setEtaMin(null);

    if(!roads) return;
    const feat = roads.features.find(x=>x.properties.f1===v.routeId);
    if(!feat) return;
    const coords = feat.geometry.coordinates.map(c=>[c[1],c[0]] as [number,number]);
    const line = turfLineString(coords.map(([lat,lng])=>[lng,lat]));
    const pt   = turfPoint([v.lng,v.lat]);
    const snap = nearestPointOnLine(line,pt);

    // calcula distancias a paradas
    const arr = (stopsByRoute[v.routeId]||[]).map(stop=>{
      const sp = turfPoint([stop.coordinate[0],stop.coordinate[1]]);
      const seg= lineSlice(snap,sp,line);
      const d  = turfLength(seg,{units:'kilometers'});
      return { stop, d, seg: seg.geometry.coordinates.map(([lng,lat])=>[lat,lng] as [number,number]) };
    }).sort((a,b)=>a.d-b.d);

    if(arr[0]){
      setDistKm(arr[0].d);
      setSegment(arr[0].seg);
      setEtaMin(await getETA(v.routeId,v.lat,v.lng));
    }
  };

  const clearSelection = () => {
    setSelVeh(null);
    setSegment([]);
    setDistKm(null);
    setEtaMin(null);
  };

  return (
    <div className="monitor-container">
      <MapContainer className="monitor-map" center={[10.3420,-84.2400]} zoom={12}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <Pane name="routes" style={{zIndex:200}}>
          {roads?.features.map(f=>(
            <Polyline
              key={f.properties.f1}
              positions={f.geometry.coordinates.map(c=>[c[1],c[0]])}
              pathOptions={{ color: '#40E0D0', weight:6, opacity:0.8 }}  // turquesa
            />
          ))}
        </Pane>
        <Pane name="history" style={{zIndex:250}}>
          {Object.entries(historyRef.current).map(([id,coords])=>(
            <Polyline key={id} positions={coords} pathOptions={{color:'#888',weight:3,opacity:0.4}}/>
          ))}
        </Pane>
        <Pane name="segment" style={{zIndex:300}}>
          {segment.length>0 && (
            <Polyline
              positions={segment}
              pathOptions={{ color: '#9C27B0', weight:8, opacity:1 }}  // púrpura
            />
          )}
        </Pane>
        <Pane name="stops" style={{zIndex:350}}>
          {roads?.features.flatMap(f=>
            (stopsByRoute[f.properties.f1]||[]).map(s=>(
              <Marker
                key={`${f.properties.f1}-${s.id}`}
                position={[s.coordinate[1],s.coordinate[0]]}
              />
            ))
          )}
        </Pane>
        <Pane name="vehicles" style={{zIndex:400}}>
          {vehicles.map(v=>(
            <CircleMarker
              key={v.id}
              center={[v.lat,v.lng]}
              radius={12}
              pathOptions={{
                color: delayed(v.timestamp)?'#D32F2F':'#388E3C',
                fillColor: delayed(v.timestamp)?'#F44336':'#4CAF50',
                fillOpacity:1
              }}
              eventHandlers={{ click: ()=>onSelect(v) }}
            />
          ))}
        </Pane>
      </MapContainer>

      {selVeh && (
        <div className="info-panel">
          <button className="close-btn" onClick={clearSelection}>×</button>
          <h2>Vehículo {selVeh.id}</h2>
          <p><strong>Ruta:</strong> {selVeh.routeId}</p>
          <p><strong>Estado:</strong> {delayed(selVeh.timestamp)?'Retrasado':'A tiempo'}</p>
          <p><strong>Distancia ↓:</strong> {distKm?.toFixed(2)} km</p>
          <p><strong>Tiempo ↓:</strong> {etaMin?.toFixed(0)} min</p>
        </div>
      )}
    </div>
  );
}