import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Popup, Polyline, CircleMarker } from 'react-leaflet';
import { getRoads, getVehicles } from '../api/transportApi';
import type { Vehicle } from '../api/transportApi';

const POLL = 5000;
const THRESH = 120;

export default function MonitoringPanel() {
  const [roads, setRoads] = useState<any>(null);
  const [vcls, setVcls] = useState<Vehicle[]>([]);

  useEffect(() => {
    getRoads().then(setRoads).catch(console.error);
    const poll = () => getVehicles().then(setVcls).catch(console.error);
    poll(); const iv = setInterval(poll,POLL);
    return ()=>clearInterval(iv);
  }, []);

  const delayed = (t:string) => (Date.now()-new Date(t).getTime())/1000 > THRESH;

  return (
    <MapContainer center={[10.36,-84.51]} zoom={13} style={{height:'100vh'}}>
      <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
      {roads && (
        <Polyline positions={roads.features.flatMap((f:any)=>f.geometry.coordinates.map((c:[number,number])=>[c[1],c[0]]))} 
                   pathOptions={{ color: 'orange', weight: 6, opacity: 0.8, }} />
      )}
      {vcls.map(v => (
       <CircleMarker
          key={v.id}
          center={[v.lat, v.lng]}
          radius={10}                  
          pathOptions={{
            color: delayed(v.timestamp) ? 'darkred' : 'limegreen',
           fillOpacity: 0.9,
          }}
        >
          <Popup>
           <div>
              <b>ID:</b> {v.id} <br />
              <b>Ruta:</b> {v.routeId} <br />
              <b>{delayed(v.timestamp) ? 'Retrasado' : 'A tiempo'}</b>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}