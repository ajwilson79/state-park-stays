import { useState } from 'react'
import { ohioParks, regions } from '../data/ohioParks'

export default function Sidebar({ visitedIds, plannedMap, favoriteParkId, visitCounts, onSelect, onHighlight, onRegionHover }) {
  const [search, setSearch] = useState('')
  const [activeRegion, setActiveRegion] = useState('All')

  const total = ohioParks.length
  const visitedCount = visitedIds.size
  const plannedCount = Object.keys(plannedMap).filter(id => !visitedIds.has(id)).length
  const pct = total > 0 ? Math.round((visitedCount / total) * 100) : 0

  const filtered = ohioParks.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesRegion = activeRegion === 'All' || p.region === activeRegion
    return matchesSearch && matchesRegion
  })

  const groupedRegions = activeRegion === 'All' ? regions : [activeRegion]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <img src="/logo.png" alt="Ohio State Park Tracker logo" className="sidebar-logo" />
        </div>
        <div className="sidebar-title-text">
          <h1>Ohio State Parks</h1>
          <p className="sidebar-subtitle">Track your adventures</p>
        </div>

        <div className="progress-section">
          <div className="progress-label">
            <span>{visitedCount} of {total} visited</span>
            <span className="progress-pct">{pct}%</span>
          </div>
          {plannedCount > 0 && (
            <div className="planned-count">{plannedCount} trip{plannedCount !== 1 ? 's' : ''} planned</div>
          )}
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="sidebar-filters">
        <input
          type="text"
          placeholder="Search parks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <div className="region-tabs">
          <button
            className={`region-tab ${activeRegion === 'All' ? 'active' : ''}`}
            onClick={() => setActiveRegion('All')}
          >
            All
          </button>
          {regions.map(r => (
            <button
              key={r}
              className={`region-tab ${activeRegion === r ? 'active' : ''}`}
              onClick={() => setActiveRegion(r)}
              onMouseEnter={() => onRegionHover(r)}
              onMouseLeave={() => onRegionHover(null)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="park-list">
        {groupedRegions.map(region => {
          const parksInRegion = filtered.filter(p => p.region === region)
          if (parksInRegion.length === 0) return null
          return (
            <div key={region} className="region-group">
              <div className="region-heading">{region}</div>
              {parksInRegion.map(park => {
                const visited = visitedIds.has(park.id)
                const planned = !visited && plannedMap[park.id]
                return (
                  <div
                    key={park.id}
                    className={`park-item ${visited ? 'visited' : planned ? 'planned' : ''}`}
                    onClick={() => onSelect(park)}
                    onMouseEnter={() => onHighlight(park.id)}
                    onMouseLeave={() => onHighlight(null)}
                  >
                    <span className={`park-check ${visited ? 'checked' : planned ? 'planned-check' : ''}`}>
                      {visited ? '✓' : planned ? '📅' : '○'}
                    </span>
                    <span className="park-name">
                      {park.name}
                      {park.id === favoriteParkId && (
                        <span className="favorite-badge" title={`Most visited (${visitCounts[park.id]} visits)`}>👑</span>
                      )}
                      {planned && <span className="planned-date-label">{plannedMap[park.id]}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="empty-state">No parks match your search.</div>
        )}
      </div>
    </aside>
  )
}
