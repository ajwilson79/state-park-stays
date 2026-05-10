import { useState, useEffect } from 'react'
import { fetchNotes, saveNotes } from '../lib/api'

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

export default function ParkModal({ park, visitedIds, plannedMap, onToggle, onSetPlanned, onRemovePlanned, onClose }) {
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState(0)
  const [notesLoading, setNotesLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [plannedDate, setPlannedDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const visited = visitedIds.has(park.id)
  const currentPlanned = plannedMap[park.id] ?? ''

  useEffect(() => {
    setNotesLoading(true)
    setSummaryLoading(true)
    setSummary(null)
    setPlannedDate(plannedMap[park.id] ?? '')
    setShowDatePicker(false)

    fetchNotes(park.id)
      .then(data => { setNotes(data.notes || ''); setRating(data.rating || 0) })
      .catch(() => {})
      .finally(() => setNotesLoading(false))

    const title = wikipediaTitle(park.name)
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.extract) setSummary({ text: data.extract, url: data.content_urls?.desktop?.page })
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [park.id])

  function handleRatingChange(newRating) {
    setRating(newRating)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await saveNotes(park.id, notes, rating)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSavePlan() {
    if (plannedDate) {
      await onSetPlanned(park.id, plannedDate)
      setShowDatePicker(false)
    }
  }

  async function handleRemovePlan() {
    setPlannedDate('')
    setShowDatePicker(false)
    await onRemovePlanned(park.id)
  }

  function handleCancelPlan() {
    setPlannedDate(currentPlanned)
    setShowDatePicker(false)
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-park-name">{park.name}</h2>
            <span className="modal-region">{park.region}</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-status-row">
          <button
            className={`visited-toggle ${visited ? 'is-visited' : ''}`}
            onClick={() => onToggle(park.id)}
          >
            {visited ? '✓ Visited' : '○ Mark as Visited'}
          </button>

          <div className="planned-controls">
            {showDatePicker ? (
              <>
                <input
                  type="date"
                  className="date-input"
                  value={plannedDate}
                  onChange={e => setPlannedDate(e.target.value)}
                  autoFocus
                />
                <button
                  className="btn-plan-save"
                  onClick={handleSavePlan}
                  disabled={!plannedDate || plannedDate === currentPlanned}
                >
                  {currentPlanned ? 'Update' : 'Save'}
                </button>
                <button className="btn-plan-remove" onClick={handleCancelPlan}>Cancel</button>
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
        </div>

        <div className="modal-summary">
          {summaryLoading ? (
            <div className="summary-loading">Loading park info...</div>
          ) : summary ? (
            <>
              <p className="summary-text">{summary.text}</p>
              {summary.url && (
                <a className="summary-link" href={summary.url} target="_blank" rel="noreferrer">
                  Read more on Wikipedia →
                </a>
              )}
            </>
          ) : null}
        </div>

        <div className="modal-notes-section">
          <div className="notes-header">
            <label className="notes-label">Notes</label>
            {!notesLoading && (
              <StarRating value={rating} onChange={handleRatingChange} />
            )}
          </div>
          {notesLoading ? (
            <div className="notes-loading">Loading...</div>
          ) : (
            <textarea
              className="notes-textarea"
              value={notes}
              onChange={e => { setNotes(e.target.value); setSaved(false) }}
              placeholder="Trip notes, best trails, camping tips, dates visited..."
              rows={4}
            />
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Close</button>
          <button className="btn-save" onClick={handleSave} disabled={saving || notesLoading}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
