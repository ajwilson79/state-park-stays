import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import ohioBoundary from '../data/ohioBoundary.json'

function MapFlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 11), { duration: 1 })
    }
  }, [target?.id])
  return null
}

const BORDER_STYLE = {
  color: '#e65100',
  weight: 3,
  opacity: 0.8,
  fillOpacity: 0,
  dashArray: '8, 5',
}

const VISITED_STYLE = {
  radius: 12,
  fillColor: '#4cde5a',
  color: '#1b5e20',
  weight: 3,
  opacity: 1,
  fillOpacity: 0.95,
}

const UNVISITED_STYLE = {
  radius: 7,
  fillColor: '#cfd8dc',
  color: '#90a4ae',
  weight: 1.5,
  opacity: 1,
  fillOpacity: 0.5,
}

const PLANNED_STYLE = {
  radius: 10,
  fillColor: '#42a5f5',
  color: '#1565c0',
  weight: 2.5,
  opacity: 1,
  fillOpacity: 0.9,
}

const FLYTO_STYLE = {
  radius: 14,
  fillColor: '#ffca28',
  color: '#e65100',
  weight: 3,
  opacity: 1,
  fillOpacity: 0.95,
}

export default function ParkMap({ parks, visitedIds, plannedMap, onSelect, highlightedId, flyTarget }) {
  return (
    <MapContainer
      center={[40.4173, -82.7]}
      zoom={7}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON data={ohioBoundary} style={BORDER_STYLE} />
      <MapFlyTo target={flyTarget} />
      {parks.map(park => {
        const visited = visitedIds.has(park.id)
        const planned = !!plannedMap[park.id]
        const isFlyTarget = park.id === flyTarget?.id
        const isSidebarHover = park.id === highlightedId
        const style = isFlyTarget ? FLYTO_STYLE : visited ? VISITED_STYLE : planned ? PLANNED_STYLE : UNVISITED_STYLE
        return (
          <CircleMarker
            key={`${park.id}-${visited}-${planned}-${isFlyTarget}`}
            center={[park.lat, park.lng]}
            radius={isSidebarHover && !isFlyTarget ? style.radius + 3 : style.radius}
            pathOptions={{
              fillColor: style.fillColor,
              color: style.color,
              weight: style.weight,
              opacity: style.opacity,
              fillOpacity: style.fillOpacity,
            }}
            eventHandlers={{ click: () => onSelect(park) }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <span style={{ fontWeight: 600 }}>{park.name}</span>
              <br />
              <span style={{ color: visited ? '#2d7d32' : planned ? '#1565c0' : '#78909c' }}>
                {visited ? '✓ Visited' : planned ? `Planned: ${plannedMap[park.id]}` : 'Not yet visited'}
              </span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
