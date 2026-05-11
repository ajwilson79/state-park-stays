import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, GeoJSON, Polygon, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import ohioBoundary from '../data/ohioBoundary.json'

function convexHull(points) {
  if (points.length < 3) return points
  let startIdx = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] < points[startIdx][1]) startIdx = i
  }
  const hull = []
  let cur = startIdx
  do {
    hull.push(points[cur])
    let next = (cur + 1) % points.length
    for (let i = 0; i < points.length; i++) {
      const cross =
        (points[next][0] - points[cur][0]) * (points[i][1] - points[cur][1]) -
        (points[next][1] - points[cur][1]) * (points[i][0] - points[cur][0])
      if (cross < 0) next = i
    }
    cur = next
  } while (cur !== startIdx)
  return hull
}

// Push each hull vertex outward from the centroid so the polygon
// encapsulates parks rather than passing through them
function inflate(hull, padding = 0.25) {
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length
  return hull.map(([lat, lng]) => {
    const dx = lat - cx, dy = lng - cy
    const d = Math.hypot(dx, dy) || 1
    return [lat + (dx / d) * padding, lng + (dy / d) * padding]
  })
}

// Chaikin curve subdivision — cuts corners repeatedly to produce smooth curves
function chaikin(pts, iterations = 3) {
  let p = pts
  for (let n = 0; n < iterations; n++) {
    const next = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length]
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]])
      next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]])
    }
    p = next
  }
  return p
}

function regionPolygon(parks) {
  const pts = parks.map(p => [p.lat, p.lng])
  return chaikin(inflate(convexHull(pts)))
}

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

const FAVORITE_STYLE = {
  radius: 13,
  fillColor: '#ffd700',
  color: '#e65100',
  weight: 3,
  opacity: 1,
  fillOpacity: 0.95,
}

const HULL_STYLE = {
  color: '#ff9100',
  weight: 2.5,
  dashArray: '8, 5',
  fillColor: '#ff9100',
  fillOpacity: 0.1,
  opacity: 0.9,
  interactive: false,
}

export default function ParkMap({ parks, visitedIds, plannedMap, favoriteParkId, onSelect, highlightedId, flyTarget, hoveredRegion }) {
  const regionHull = useMemo(() => {
    if (!hoveredRegion) return null
    return regionPolygon(parks.filter(p => p.region === hoveredRegion))
  }, [hoveredRegion, parks])

  return (
    <MapContainer
      center={[40.2, -82.7]}
      zoom={7.5}
      zoomSnap={0.5}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON data={ohioBoundary} style={BORDER_STYLE} />
      <MapFlyTo target={flyTarget} />
      {regionHull && (
        <Polygon key={hoveredRegion} positions={regionHull} pathOptions={HULL_STYLE} />
      )}
      {parks.map(park => {
        const visited = visitedIds.has(park.id)
        const planned = !!plannedMap[park.id]
        const isFlyTarget = park.id === flyTarget?.id
        const isFavorite = park.id === favoriteParkId
        const isSidebarHover = park.id === highlightedId
        const inHoveredRegion = hoveredRegion && park.region === hoveredRegion
        const dimmed = hoveredRegion && !inHoveredRegion && !isFlyTarget
        const style = isFlyTarget ? FLYTO_STYLE : isFavorite ? FAVORITE_STYLE : visited ? VISITED_STYLE : planned ? PLANNED_STYLE : UNVISITED_STYLE
        const radius = isFlyTarget ? style.radius
          : inHoveredRegion ? style.radius + 4
          : isSidebarHover ? style.radius + 3
          : style.radius
        return (
          <CircleMarker
            key={`${park.id}-${visited}-${planned}-${isFlyTarget}-${isFavorite}-${inHoveredRegion}`}
            center={[park.lat, park.lng]}
            radius={radius}
            pathOptions={{
              fillColor: style.fillColor,
              color: inHoveredRegion || isSidebarHover ? '#ff9100' : style.color,
              weight: inHoveredRegion || isSidebarHover ? 2.5 : style.weight,
              opacity: dimmed ? 0.08 : style.opacity,
              fillOpacity: dimmed ? 0.08 : style.fillOpacity,
            }}
            eventHandlers={{ click: () => onSelect(park) }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <span style={{ fontWeight: 600 }}>{park.name}{isFavorite ? ' 👑' : ''}</span>
              <br />
              <span style={{ color: isFavorite ? '#e65100' : visited ? '#2d7d32' : planned ? '#1565c0' : '#78909c' }}>
                {isFavorite ? 'Your favorite park' : visited ? '✓ Visited' : planned ? `Planned: ${plannedMap[park.id]}` : 'Not yet visited'}
              </span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
