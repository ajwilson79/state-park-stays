import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, GeoJSON, Polygon, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
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

// Buffer each park into a ring of sample points, then hull + smooth.
// This guarantees every park has clearance before Chaikin cuts corners inward.
function regionPolygon(parks) {
  const BUFFER = 0.18
  const SIDES = 10
  const expanded = parks.flatMap(({ lat, lng }) =>
    Array.from({ length: SIDES }, (_, i) => {
      const a = (2 * Math.PI * i) / SIDES
      return [lat + BUFFER * Math.cos(a), lng + BUFFER * Math.sin(a)]
    })
  )
  return chaikin(convexHull(expanded))
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

const RANK_LABELS = { 1: '🥇', 2: '🥈', 3: '🥉' }
const RANK_TITLES = { 1: 'Most visited park', 2: '2nd most visited', 3: '3rd most visited' }
const RANK_BG    = { 1: '#ffd700', 2: '#d8d8d8', 3: '#cd7f32' }
const RANK_BORDER = { 1: '#b8860b', 2: '#757575', 3: '#6d4c00' }
const RANK_SIZE  = { 1: 34, 2: 30, 3: 28 }

function medalIcon(rank, dimmed, highlighted) {
  const size = RANK_SIZE[rank]
  const bg = RANK_BG[rank]
  const border = highlighted ? '#ff9100' : RANK_BORDER[rank]
  const opacity = dimmed ? 0.1 : 1
  const fontSize = rank === 1 ? 18 : 16
  return divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${bg};border:2.5px solid ${border};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;box-shadow:0 2px 6px rgba(0,0,0,0.45);opacity:${opacity};">${RANK_LABELS[rank]}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -(size / 2) - 4],
  })
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

export default function ParkMap({ parks, visitedIds, plannedMap, parkRanks, onSelect, highlightedId, flyTarget, hoveredRegion }) {
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
        const rank = parkRanks[park.id] ?? null
        const isSidebarHover = park.id === highlightedId
        const inHoveredRegion = hoveredRegion && park.region === hoveredRegion
        const dimmed = hoveredRegion && !inHoveredRegion && !isFlyTarget
        if (rank) return null  // rendered separately below as medal markers
        const style = isFlyTarget ? FLYTO_STYLE : visited ? VISITED_STYLE : planned ? PLANNED_STYLE : UNVISITED_STYLE
        const radius = isFlyTarget ? style.radius
          : inHoveredRegion ? style.radius + 4
          : isSidebarHover ? style.radius + 3
          : style.radius
        return (
          <CircleMarker
            key={`${park.id}-${visited}-${planned}-${isFlyTarget}-${inHoveredRegion}`}
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
              <span style={{ fontWeight: 600 }}>{park.name}</span>
              <br />
              <span style={{ color: visited ? '#2d7d32' : planned ? '#1565c0' : '#78909c' }}>
                {visited ? '✓ Visited' : planned ? `Planned: ${plannedMap[park.id]}` : 'Not yet visited'}
              </span>
            </Tooltip>
          </CircleMarker>
        )
      })}
      {parks.map(park => {
        const rank = parkRanks[park.id] ?? null
        if (!rank) return null
        const visited = visitedIds.has(park.id)
        const planned = !!plannedMap[park.id]
        const isFlyTarget = park.id === flyTarget?.id
        const isSidebarHover = park.id === highlightedId
        const inHoveredRegion = hoveredRegion && park.region === hoveredRegion
        const dimmed = hoveredRegion && !inHoveredRegion && !isFlyTarget
        const highlighted = inHoveredRegion || isSidebarHover
        return (
          <Marker
            key={`medal-${park.id}-${rank}-${dimmed}-${highlighted}-${isFlyTarget}`}
            position={[park.lat, park.lng]}
            icon={medalIcon(rank, dimmed, highlighted)}
            eventHandlers={{ click: () => onSelect(park) }}
          >
            <Tooltip direction="top" offset={[0, 0]} opacity={0.95}>
              <span style={{ fontWeight: 600 }}>{RANK_LABELS[rank]} {park.name}</span>
              <br />
              <span style={{ color: '#b8860b' }}>{RANK_TITLES[rank]}</span>
              {visited && <><br /><span style={{ color: '#2d7d32' }}>✓ Visited</span></>}
            </Tooltip>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
