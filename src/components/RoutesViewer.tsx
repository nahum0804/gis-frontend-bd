import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Pane } from 'react-leaflet';
import { getRoads, getETA } from '../api/transportApi';
import type { RoadFeatureCollection } from '../api/transportApi';

export default function RoutesViewer() {
  const [roads, setRoads] = useState<RoadFeatureCollection | null>(null);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [etaMsg, setEtaMsg] = useState('');

  useEffect(() => {
    getRoads().then(setRoads).catch(console.error);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPos([coords.latitude, coords.longitude]),
      console.error
    );
  }, []);

  const onFeatureClick = async (props: any, layer: any) => {
    if (!pos) return;
    const e = await getETA(props.f1, pos[0], pos[1]);
    setEtaMsg(`ETA ruta ${props.f1}: ${e.toFixed(0)} min`);
    layer.openPopup();
  };

  return (
    <div style={{ height: '100vh' }}>
      <MapContainer center={[10.36, -84.51]} zoom={14} style={{ height: '100%' }}>
        <Pane name="highlight" style={{ zIndex: 650 }} />
        <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
        {roads && (
          <GeoJSON
            data={roads}
            style={() => ({
              color: 'crimson',       
              weight: 8,              
              opacity: 0.75,         
              dashArray: '10,6',      
            })}
            onEachFeature={(feat, lyr) => {
              lyr.setStyle({ interactive: true, pane: 'overlayPane' });
              lyr.on({ click: () => onFeatureClick(feat.properties, lyr) });
              lyr.bindPopup(`<b>ID:</b> ${feat.properties.f1}`);
            }}
          />
        )}
        {pos && <Marker position={pos}><Popup>Tu ubicación</Popup></Marker>}
      </MapContainer>
      {etaMsg && <div style={{position:'absolute', top:10,left:10, background:'#fff', padding:8}}>{etaMsg}</div>}
    </div>
  );
}