import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchVisited, markVisited, markUnvisited, fetchPlanned, setPlanned, removePlanned, fetchVisitCounts, addParkVisit, deleteParkVisit } from '../lib/api'

export function useVisitedParks() {
  const [visitedIds, setVisitedIds] = useState(new Set())
  const [plannedMap, setPlannedMap] = useState({}) // parkId -> date string
  const [visitCounts, setVisitCounts] = useState({}) // parkId -> count
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchVisited(), fetchPlanned(), fetchVisitCounts()])
      .then(([visited, planned, counts]) => {
        setVisitedIds(new Set(visited.map(r => r.park_id)))
        const pMap = {}
        planned.forEach(r => { pMap[r.park_id] = r.planned_date })
        setPlannedMap(pMap)
        const cMap = {}
        counts.forEach(r => { cMap[r.park_id] = r.count })
        setVisitCounts(cMap)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const favoriteParkId = useMemo(() => {
    const entries = Object.entries(visitCounts)
    if (entries.length === 0) return null
    const [id, max] = entries.reduce((best, cur) => cur[1] > best[1] ? cur : best)
    return max >= 1 ? id : null
  }, [visitCounts])

  const toggleVisited = useCallback(async (parkId) => {
    const isVisited = visitedIds.has(parkId)
    const wasPlanned = !!plannedMap[parkId]

    setVisitedIds(prev => {
      const next = new Set(prev)
      if (isVisited) next.delete(parkId)
      else next.add(parkId)
      return next
    })
    // marking visited clears planned
    if (!isVisited && wasPlanned) {
      setPlannedMap(prev => { const n = { ...prev }; delete n[parkId]; return n })
    }

    try {
      if (isVisited) {
        await markUnvisited(parkId)
      } else {
        await markVisited(parkId)
        if (wasPlanned) await removePlanned(parkId)
      }
    } catch (err) {
      setError(err.message)
      setVisitedIds(prev => {
        const next = new Set(prev)
        if (isVisited) next.add(parkId)
        else next.delete(parkId)
        return next
      })
      if (!isVisited && wasPlanned) {
        setPlannedMap(prev => ({ ...prev, [parkId]: plannedMap[parkId] }))
      }
    }
  }, [visitedIds, plannedMap])

  const setParkPlanned = useCallback(async (parkId, date) => {
    setPlannedMap(prev => ({ ...prev, [parkId]: date }))
    try {
      await setPlanned(parkId, date)
    } catch (err) {
      setError(err.message)
      setPlannedMap(prev => { const n = { ...prev }; delete n[parkId]; return n })
    }
  }, [])

  const removeParkPlanned = useCallback(async (parkId) => {
    const oldDate = plannedMap[parkId]
    setPlannedMap(prev => { const n = { ...prev }; delete n[parkId]; return n })
    try {
      await removePlanned(parkId)
    } catch (err) {
      setError(err.message)
      setPlannedMap(prev => ({ ...prev, [parkId]: oldDate }))
    }
  }, [plannedMap])

  const addVisit = useCallback(async (parkId, date) => {
    setVisitCounts(prev => ({ ...prev, [parkId]: (prev[parkId] ?? 0) + 1 }))
    try {
      return await addParkVisit(parkId, date)
    } catch (err) {
      setError(err.message)
      setVisitCounts(prev => {
        const n = { ...prev }
        if (n[parkId] > 1) n[parkId] -= 1
        else delete n[parkId]
        return n
      })
      throw err
    }
  }, [])

  const removeVisit = useCallback(async (parkId, visitId) => {
    setVisitCounts(prev => {
      const n = { ...prev }
      if ((n[parkId] ?? 0) > 1) n[parkId] -= 1
      else delete n[parkId]
      return n
    })
    try {
      await deleteParkVisit(parkId, visitId)
    } catch (err) {
      setError(err.message)
      setVisitCounts(prev => ({ ...prev, [parkId]: (prev[parkId] ?? 0) + 1 }))
      throw err
    }
  }, [])

  return { visitedIds, plannedMap, visitCounts, favoriteParkId, loading, error, toggleVisited, setParkPlanned, removeParkPlanned, addVisit, removeVisit }
}
