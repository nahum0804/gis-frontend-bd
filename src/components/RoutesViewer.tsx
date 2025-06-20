import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Pane } from 'react-leaflet';
import { getETA, getRoads } from '../api/transportApi';
import { getRouteColor } from '../utils/colors';
import type { RoadFeatureCollection } from '../api/transportApi';

interface Props { selectedRoute?: number; }

export default function RoutesViewer({ selectedRoute }: Props) {
  const [roads, setRoads] = useState<RoadFeatureCollection | null>(null);
  const [etaMsg, setEtaMsg] = useState('');
  useEffect(() => { getRoads().then(setRoads).catch(console.error); }, []);
  const handleClick = async (props: any, layer: any) => {
    const userPos = await new Promise<[number,number]>((res,rej) =>
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => res([coords.latitude, coords.longitude]),
        rej
      )
    );
    const e = await getETA(props.f1, userPos[0], userPos[1]);
    setEtaMsg(`ETA ${props.f2}: ${e.toFixed(0)} min`);
    layer.openPopup();
  };
  return (
    <div style={{ height: '100vh', position: 'relative' }}>
      <MapContainer center={[10.3420, -84.2400]} zoom={12} style={{ height: '100%' }}>
        <Pane name="highlight" style={{ zIndex: 650 }} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CartoDB" />
        {roads && (
          <GeoJSON
            data={selectedRoute
              ? { type: 'FeatureCollection', features: roads.features.filter(f => f.properties.f1 === selectedRoute) }
              : roads}
            style={feat => ({ color: getRouteColor(feat.properties.f1), weight: 8, opacity: 0.75 })}
            onEachFeature={(feat, lyr) => { lyr.on({ click: () => handleClick(feat.properties, lyr) }); lyr.bindPopup(`<b>${feat.properties.f2}</b>`); }}
          />
        )}
      </MapContainer>
      {etaMsg && <div className="eta-popup">{etaMsg}</div>}
    </div>
  );
}
