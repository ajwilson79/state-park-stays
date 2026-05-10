const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchVisited() {
  const res = await fetch(`${BASE}/api/visited`)
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

export async function markVisited(parkId) {
  const res = await fetch(`${BASE}/api/visited/${encodeURIComponent(parkId)}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

export async function markUnvisited(parkId) {
  const res = await fetch(`${BASE}/api/visited/${encodeURIComponent(parkId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

export async function fetchPlanned() {
  const res = await fetch(`${BASE}/api/planned`)
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

export async function setPlanned(parkId, plannedDate) {
  const res = await fetch(`${BASE}/api/planned/${encodeURIComponent(parkId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planned_date: plannedDate }),
  })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

export async function removePlanned(parkId) {
  const res = await fetch(`${BASE}/api/planned/${encodeURIComponent(parkId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

export async function fetchNotes(parkId) {
  const res = await fetch(`${BASE}/api/notes/${encodeURIComponent(parkId)}`)
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

export async function saveNotes(parkId, notes, rating) {
  const res = await fetch(`${BASE}/api/notes/${encodeURIComponent(parkId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes, rating }),
  })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}
