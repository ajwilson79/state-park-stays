import { useState, useEffect, useCallback } from 'react'
import { fetchVisited, markVisited, markUnvisited, fetchPlanned, setPlanned, removePlanned } from '../lib/api'

export function useVisitedParks() {
  const [visitedIds, setVisitedIds] = useState(new Set())
  const [plannedMap, setPlannedMap] = useState({}) // parkId -> date string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchVisited(), fetchPlanned()])
      .then(([visited, planned]) => {
        setVisitedIds(new Set(visited.map(r => r.park_id)))
        const pMap = {}
        planned.forEach(r => { pMap[r.park_id] = r.planned_date })
        setPlannedMap(pMap)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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

  return { visitedIds, plannedMap, loading, error, toggleVisited, setParkPlanned, removeParkPlanned }
}
