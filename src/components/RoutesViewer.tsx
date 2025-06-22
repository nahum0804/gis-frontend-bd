import { useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  GeoJSON
} from 'react-leaflet'

import { getRoads, getETA } from '../api/transportApi'
import { getRouteColor }    from '../utils/colors'
import type { RoadFeatureCollection } from '../api/transportApi'

interface Props { selectedRoute?: number }

export default function RoutesViewer({ selectedRoute }: Props) {
  const [roads, setRoads] = useState<RoadFeatureCollection|null>(null)
  const [etaMsg, setEtaMsg] = useState('')

  useEffect(() => {
    getRoads().then(setRoads).catch(console.error)
  }, [])

  const handleClick = async (props: any, layer: any) => {
    // si quisieras ETA basado en un vehículo concreto, tendrías que
    // pasar aquí el `vehicleId` a getETA; ahora lo ignoramos
    // y simplemente mostramos la ruta:
    layer.openPopup()
  }

  return (
    <div style={{ height: '100vh', position: 'relative' }}>
      <MapContainer center={[10.3420, -84.2400]} zoom={12} style={{ height: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CartoDB"
        />
        {roads && (
          <GeoJSON
            data={
              selectedRoute
                ? {
                    type: 'FeatureCollection',
                    features: roads.features.filter(f => f.properties.f1 === selectedRoute)
                  }
                : roads
            }
            style={feat => ({
              color: getRouteColor(feat.properties.f1),
              weight: 8,
              opacity: 0.75
            })}
            onEachFeature={(feat, lyr) => {
              lyr.bindPopup(`<b>${feat.properties.f2}</b>`)
              lyr.on({ click: () => handleClick(feat.properties, lyr) })
            }}
          />
        )}
      </MapContainer>
      {etaMsg && <div className="eta-popup">{etaMsg}</div>}
    </div>
  )
}
