import { useState } from 'react'
import ParkMap from './components/ParkMap'
import Sidebar from './components/Sidebar'
import ParkModal from './components/ParkModal'
import { useVisitedParks } from './hooks/useVisitedParks'
import { ohioParks } from './data/ohioParks'

export default function App() {
  const { visitedIds, plannedMap, visitCounts, favoriteParkId, loading, error, toggleVisited, setParkPlanned, removeParkPlanned, addVisit, removeVisit } = useVisitedParks()
  const [highlightedId, setHighlightedId] = useState(null)
  const [selectedPark, setSelectedPark] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [hoveredRegion, setHoveredRegion] = useState(null)

  function handleSidebarSelect(park) {
    setFlyTarget(park)
  }

  function handleMapSelect(park) {
    setSelectedPark(park)
    setFlyTarget(null)
  }

  return (
    <div className="app">
      <Sidebar
        visitedIds={visitedIds}
        plannedMap={plannedMap}
        favoriteParkId={favoriteParkId}
        visitCounts={visitCounts}
        onSelect={handleSidebarSelect}
        onHighlight={setHighlightedId}
        onRegionHover={setHoveredRegion}
      />
      <main className="map-container" style={{ position: 'relative' }}>
        {loading ? (
          <div className="map-loading">Loading parks...</div>
        ) : error ? (
          <div className="map-error">
            <p>Could not connect to the local server.</p>
            <p className="error-detail">Make sure you started the app with <code>npm run dev</code>.</p>
            <p className="error-detail">{error}</p>
          </div>
        ) : (<>
          {flyTarget && (
            <div className="map-hint">
              Click the marker to view details for {flyTarget.name}
            </div>
          )}
          <ParkMap
            parks={ohioParks}
            visitedIds={visitedIds}
            plannedMap={plannedMap}
            favoriteParkId={favoriteParkId}
            onSelect={handleMapSelect}
            highlightedId={highlightedId}
            flyTarget={flyTarget}
            hoveredRegion={hoveredRegion}
          /></>
        )}
      </main>

      {selectedPark && (
        <ParkModal
          park={selectedPark}
          visitedIds={visitedIds}
          plannedMap={plannedMap}
          isFavorite={selectedPark.id === favoriteParkId}
          onToggle={toggleVisited}
          onSetPlanned={setParkPlanned}
          onRemovePlanned={removeParkPlanned}
          onAddVisit={addVisit}
          onRemoveVisit={removeVisit}
          onClose={() => setSelectedPark(null)}
        />
      )}
    </div>
  )
}
