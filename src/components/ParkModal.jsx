import { useState, useEffect } from 'react'
import { fetchNotes, saveNotes, fetchParkVisits } from '../lib/api'

const TODAY = new Date().toISOString().slice(0, 10)

function nightsBetween(start, end) {
  if (!end || end === start) return 0
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 86400000))
}

function stayNights(start, end) {
  // For ranking: day trips count as 1
  const n = nightsBetween(start, end)
  return n === 0 ? 1 : n
}

function formatStay(start, end) {
  const nights = nightsBetween(start, end)
  if (nights === 0) return `${start} · Day trip`
  return `${start} – ${end} · ${nights} night${nights !== 1 ? 's' : ''}`
}

function nightsLabel(start, end) {
  const nights = nightsBetween(start, end)
  if (nights === 0) return 'Day trip'
  return `${nights} night${nights !== 1 ? 's' : ''}`
}

function wikipediaTitle(parkName) {
  return parkName.replace(/ /g, '_')
}

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          className={`star ${star <= (hovered || value) ? 'filled' : ''}`}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star === value ? 0 : star)}
          title={`${star} star${star !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
      {value > 0 && <span className="star-label">{value}/5</span>}
    </div>
  )
}

const RANK_LABELS = { 1: '🥇', 2: '🥈', 3: '🥉' }
const RANK_TITLES = { 1: 'Your Favorite Park', 2: '2nd Most Visited', 3: '3rd Most Visited' }

export default function ParkModal({ park, visitedIds, plannedMap, parkRank, onMarkUnvisited, onSetPlanned, onRemovePlanned, onAddVisit, onRemoveVisit, onClose }) {
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState(0)
  const [notesLoading, setNotesLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [plannedDate, setPlannedDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [userPhoto, setUserPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [visits, setVisits] = useState([])
  const [showAddVisit, setShowAddVisit] = useState(false)
  const [newStartDate, setNewStartDate] = useState(TODAY)
  const [newEndDate, setNewEndDate] = useState(TODAY)

  const visited = visitedIds.has(park.id)
  const currentPlanned = plannedMap[park.id] ?? ''

  useEffect(() => {
    setNotesLoading(true)
    setSummaryLoading(true)
    setSummary(null)
    setPlannedDate(plannedMap[park.id] ?? '')
    setShowDatePicker(false)
    setUserPhoto(null)
    setVisits([])
    setShowAddVisit(false)
    setNewStartDate(TODAY)
    setNewEndDate(TODAY)
    fetchParkVisits(park.id).then(setVisits).catch(() => {})
    fetch(`/api/images/${park.id}`, { method: 'HEAD' })
      .then(r => setUserPhoto(r.ok ? `/api/images/${park.id}?t=${Date.now()}` : false))
      .catch(() => setUserPhoto(false))

    fetchNotes(park.id)
      .then(data => { setNotes(data.notes || ''); setRating(data.rating || 0) })
      .catch(() => {})
      .finally(() => setNotesLoading(false))

    const title = wikipediaTitle(park.name)
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    const wikiImgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=480&format=json&origin=*`
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(park.name)}&gsrlimit=10&prop=imageinfo&iiprop=url|dimensions|mime&iiurlwidth=480&format=json&origin=*`
    const isUnsuitable = url => /map|locator|location_map|relief|blank|survey|NARA|DPLA|chart|diagram/i.test(url)

    Promise.all([
      fetch(summaryUrl).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(wikiImgUrl).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(commonsUrl).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([summaryData, wikiImgData, commonsData]) => {
      if (!summaryData?.extract) return
      const wikiPages = wikiImgData?.query?.pages ?? {}
      const wikiImage = Object.values(wikiPages)[0]?.thumbnail?.source ?? null
      if (wikiImage && !isUnsuitable(wikiImage)) {
        setSummary({ text: summaryData.extract, url: summaryData.content_urls?.desktop?.page, image: wikiImage })
        return
      }
      const commonsPages = Object.values(commonsData?.query?.pages ?? {})
      const commonsImage = commonsPages
        .map(p => p.imageinfo?.[0])
        .filter(info => info && (info.mime === 'image/jpeg' || info.mime === 'image/png') && info.width > info.height && !isUnsuitable(info.url))
        .sort((a, b) => (b.width / b.height) - (a.width / a.height))[0]?.url ?? null
      setSummary({ text: summaryData.extract, url: summaryData.content_urls?.desktop?.page, image: commonsImage })
    }).finally(() => setSummaryLoading(false))
  }, [park.id])

  async function handleSave() {
    setSaving(true)
    await saveNotes(park.id, notes, rating)
    setSaving(false)
    onClose()
  }

  async function handleSavePlan() {
    if (plannedDate) { await onSetPlanned(park.id, plannedDate); setShowDatePicker(false) }
  }

  async function handleRemovePlan() {
    setPlannedDate(''); setShowDatePicker(false); await onRemovePlanned(park.id)
  }

  async function handleAddVisit() {
    if (!newStartDate) return
    const entry = await onAddVisit(park.id, newStartDate, newEndDate)
    setVisits(prev => [entry, ...prev].sort((a, b) => b.start_date.localeCompare(a.start_date)))
    setNewStartDate(TODAY)
    setNewEndDate(TODAY)
    setShowAddVisit(false)
  }

  async function handleDeleteVisit(v) {
    await onRemoveVisit(park.id, v.id, stayNights(v.start_date, v.end_date))
    setVisits(prev => prev.filter(x => x.id !== v.id))
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('photo', file)
    await fetch(`/api/images/${park.id}`, { method: 'POST', body: form })
    setUserPhoto(`/api/images/${park.id}?t=${Date.now()}`)
    setUploading(false)
    e.target.value = ''
  }

  async function handleRemovePhoto() {
    await fetch(`/api/images/${park.id}`, { method: 'DELETE' })
    setUserPhoto(false)
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const logTitle = parkRank ? `${RANK_LABELS[parkRank]} ${RANK_TITLES[parkRank]}` : visited ? 'Visit Log' : 'Visits'

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal">

        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h2 className="modal-park-name">
              {park.name}
              {parkRank && <span className="modal-favorite-badge" title={RANK_TITLES[parkRank]}>{RANK_LABELS[parkRank]}</span>}
            </h2>
            <span className="modal-region">{park.region}</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
        {(() => {
          const displayImage = userPhoto || summary?.image
          if (displayImage) return (
            <div className="modal-banner">
              <img src={displayImage} alt={park.name} className="modal-banner-img" onError={e => { e.currentTarget.style.display = 'none' }} />
              {visited && (
                <label className="banner-upload-btn" title={userPhoto ? 'Replace photo' : 'Add your photo'}>
                  {uploading ? '...' : userPhoto ? '📷 Replace' : '📷 Add your photo'}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
                </label>
              )}
              {userPhoto && <button className="banner-remove-btn" onClick={handleRemovePhoto} title="Remove your photo">✕</button>}
            </div>
          )
          if (visited) return (
            <label className="banner-upload-prompt">
              <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
              {uploading ? 'Uploading...' : '📷 Add a photo from your visit'}
            </label>
          )
          return null
        })()}

        {/* Visit log — primary action for all parks */}
        <div className="visit-log-section">
          <div className="visit-log-header">
            <span className="visit-log-title">
              {logTitle}
              {visits.length > 0 && <span className="visit-count-badge">{visits.length}</span>}
            </span>
            {!showAddVisit && (
              <button className="btn-add-visit" onClick={() => { setShowAddVisit(true); setNewVisitDate(TODAY) }}>
                + Log a Visit
              </button>
            )}
          </div>

          {showAddVisit && (
            <div className="add-visit-form">
              <div className="add-visit-dates">
                <div className="date-field">
                  <label className="date-field-label">Check-in</label>
                  <input
                    type="date"
                    className="date-input"
                    value={newStartDate}
                    max={TODAY}
                    onChange={e => {
                      setNewStartDate(e.target.value)
                      if (newEndDate < e.target.value) setNewEndDate(e.target.value)
                    }}
                    autoFocus
                  />
                </div>
                <div className="date-field">
                  <label className="date-field-label">Check-out</label>
                  <input
                    type="date"
                    className="date-input"
                    value={newEndDate}
                    min={newStartDate}
                    max={TODAY}
                    onChange={e => setNewEndDate(e.target.value)}
                  />
                </div>
                <span className="stay-duration-label">{nightsLabel(newStartDate, newEndDate)}</span>
              </div>
              <div className="add-visit-row">
                <button className="btn-plan-save" onClick={handleAddVisit} disabled={!newStartDate}>Save</button>
                <button className="btn-plan-remove" onClick={() => setShowAddVisit(false)}>Cancel</button>
              </div>
            </div>
          )}

          {visits.length > 0 ? (
            <div className="visit-list">
              {visits.map(v => (
                <div key={v.id} className="visit-entry">
                  <span className="visit-date">{formatStay(v.start_date, v.end_date)}</span>
                  <button className="visit-delete" onClick={() => handleDeleteVisit(v)} title="Remove this visit">✕</button>
                </div>
              ))}
            </div>
          ) : !showAddVisit && (
            <p className="visit-log-empty">
              {visited
                ? <>Visited but no dates recorded. <button className="btn-link" onClick={() => onMarkUnvisited(park.id)}>Remove visited status</button></>
                : 'Not visited yet — log your first trip above.'}
            </p>
          )}
        </div>

        {/* Plan visit — only for unvisited parks */}
        {!visited && (
          <div className="modal-plan-row">
            {showDatePicker ? (
              <>
                <input type="date" className="date-input" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} autoFocus />
                <button className="btn-plan-save" onClick={handleSavePlan} disabled={!plannedDate || plannedDate === currentPlanned}>
                  {currentPlanned ? 'Update' : 'Save'}
                </button>
                <button className="btn-plan-remove" onClick={() => { setPlannedDate(currentPlanned); setShowDatePicker(false) }}>Cancel</button>
              </>
            ) : currentPlanned ? (
              <>
                <span className="planned-date-display">📅 {currentPlanned}</span>
                <button className="btn-plan-change" onClick={() => setShowDatePicker(true)}>Change</button>
                <button className="btn-plan-remove" onClick={handleRemovePlan}>Remove</button>
              </>
            ) : (
              <button className="btn-plan-visit" onClick={() => setShowDatePicker(true)}>📅 Plan Visit</button>
            )}
          </div>
        )}

        <div className="modal-summary">
          {summaryLoading ? (
            <div className="summary-loading">Loading park info...</div>
          ) : summary ? (
            <>
              <p className="summary-text">{summary.text}</p>
              {summary.url && <a className="summary-link" href={summary.url} target="_blank" rel="noreferrer">Read more on Wikipedia →</a>}
            </>
          ) : null}
        </div>

        <div className="modal-notes-section">
          <div className="notes-header">
            <label className="notes-label">Notes</label>
            {!notesLoading && <StarRating value={rating} onChange={r => { setRating(r); setSaved(false) }} />}
          </div>
          {notesLoading ? (
            <div className="notes-loading">Loading...</div>
          ) : (
            <textarea
              className="notes-textarea"
              value={notes}
              onChange={e => { setNotes(e.target.value); setSaved(false) }}
              placeholder="Trip notes, best trails, camping tips..."
              rows={4}
            />
          )}
        </div>

        </div>{/* end modal-body */}

        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn-cancel" onClick={onClose}>Close without saving</button>
          <button className="btn-save" onClick={handleSave} disabled={saving || notesLoading}>
            {saving ? 'Saving...' : 'Save & Close'}
          </button>
        </div>

      </div>
    </div>
  )
}
