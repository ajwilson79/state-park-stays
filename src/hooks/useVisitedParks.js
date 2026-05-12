import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchVisited, markVisited, markUnvisited, fetchPlanned, setPlanned, removePlanned, fetchVisitCounts, addParkVisit, deleteParkVisit } from '../lib/api'

function stayNights(startDate, endDate) {
  if (!endDate || endDate === startDate) return 1 // day trip counts as 1
  const diff = Math.round((new Date(endDate) - new Date(startDate)) / 86400000)
  return Math.max(1, diff)
}

export function useVisitedParks() {
  const [visitedIds, setVisitedIds] = useState(new Set())
  const [plannedMap, setPlannedMap] = useState({})
  const [visitDays, setVisitDays] = useState({}) // parkId -> total nights (day trips = 1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchVisited(), fetchPlanned(), fetchVisitCounts()])
      .then(([visited, planned, counts]) => {
        setVisitedIds(new Set(visited.map(r => r.park_id)))
        const pMap = {}
        planned.forEach(r => { pMap[r.park_id] = r.planned_date })
        setPlannedMap(pMap)
        const dMap = {}
        counts.forEach(r => { dMap[r.park_id] = r.total_nights })
        setVisitDays(dMap)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Top 3 parks by total nights; require >= 2 to earn a medal
  const parkRanks = useMemo(() => {
    const entries = Object.entries(visitDays).filter(([, d]) => d >= 2)
    if (entries.length === 0) return {}
    entries.sort((a, b) => b[1] - a[1])
    const ranks = {}
    entries.slice(0, 3).forEach(([id], i) => { ranks[id] = i + 1 })
    return ranks
  }, [visitDays])

  const toggleVisited = useCallback(async (parkId) => {
    const isVisited = visitedIds.has(parkId)
    const wasPlanned = !!plannedMap[parkId]
    setVisitedIds(prev => { const n = new Set(prev); if (isVisited) n.delete(parkId); else n.add(parkId); return n })
    if (!isVisited && wasPlanned) setPlannedMap(prev => { const n = { ...prev }; delete n[parkId]; return n })
    try {
      if (isVisited) await markUnvisited(parkId)
      else { await markVisited(parkId); if (wasPlanned) await removePlanned(parkId) }
    } catch (err) {
      setError(err.message)
      setVisitedIds(prev => { const n = new Set(prev); if (isVisited) n.add(parkId); else n.delete(parkId); return n })
      if (!isVisited && wasPlanned) setPlannedMap(prev => ({ ...prev, [parkId]: plannedMap[parkId] }))
    }
  }, [visitedIds, plannedMap])

  const setParkPlanned = useCallback(async (parkId, date) => {
    setPlannedMap(prev => ({ ...prev, [parkId]: date }))
    try { await setPlanned(parkId, date) }
    catch (err) { setError(err.message); setPlannedMap(prev => { const n = { ...prev }; delete n[parkId]; return n }) }
  }, [])

  const removeParkPlanned = useCallback(async (parkId) => {
    const oldDate = plannedMap[parkId]
    setPlannedMap(prev => { const n = { ...prev }; delete n[parkId]; return n })
    try { await removePlanned(parkId) }
    catch (err) { setError(err.message); setPlannedMap(prev => ({ ...prev, [parkId]: oldDate })) }
  }, [plannedMap])

  const addVisit = useCallback(async (parkId, startDate, endDate) => {
    const wasVisited = visitedIds.has(parkId)
    const wasPlanned = !!plannedMap[parkId]
    const prevDays = visitDays[parkId] ?? 0
    const nights = stayNights(startDate, endDate)
    setVisitDays(prev => ({ ...prev, [parkId]: prevDays + nights }))
    if (!wasVisited) setVisitedIds(prev => { const n = new Set(prev); n.add(parkId); return n })
    if (!wasVisited && wasPlanned) setPlannedMap(prev => { const n = { ...prev }; delete n[parkId]; return n })
    try {
      const result = await addParkVisit(parkId, startDate, endDate)
      if (!wasVisited && wasPlanned) removePlanned(parkId)
      return result
    } catch (err) {
      setError(err.message)
      setVisitDays(prev => { const n = { ...prev }; if (prevDays > 0) n[parkId] = prevDays; else delete n[parkId]; return n })
      if (!wasVisited) setVisitedIds(prev => { const n = new Set(prev); n.delete(parkId); return n })
      if (!wasVisited && wasPlanned) setPlannedMap(prev => ({ ...prev, [parkId]: plannedMap[parkId] }))
      throw err
    }
  }, [visitedIds, plannedMap, visitDays])

  const removeVisit = useCallback(async (parkId, visitId, nights) => {
    const prevDays = visitDays[parkId] ?? 0
    const newDays = Math.max(0, prevDays - nights)
    setVisitDays(prev => { const n = { ...prev }; if (newDays > 0) n[parkId] = newDays; else delete n[parkId]; return n })
    if (newDays === 0) setVisitedIds(prev => { const n = new Set(prev); n.delete(parkId); return n })
    try {
      await deleteParkVisit(parkId, visitId)
    } catch (err) {
      setError(err.message)
      setVisitDays(prev => ({ ...prev, [parkId]: prevDays }))
      if (newDays === 0) setVisitedIds(prev => { const n = new Set(prev); n.add(parkId); return n })
      throw err
    }
  }, [visitDays])

  return { visitedIds, plannedMap, visitDays, parkRanks, loading, error, toggleVisited, setParkPlanned, removeParkPlanned, addVisit, removeVisit }
}
