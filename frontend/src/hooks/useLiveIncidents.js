import { useCallback, useEffect, useState } from 'react'
import { fetchIncidents } from '../api/incidents'

// Concept: polling. Instead of WebSockets we simply ask the server again every
// 30 seconds. It's simple, easy to debug, and fresh enough for this project.
// The effect re-runs (and the timer resets) whenever the category filter changes.

const POLL_MS = 30_000

export function useLiveIncidents(category) {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchIncidents({ category })
      setIncidents(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    setLoading(true)
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer) // cleanup so timers don't pile up
  }, [load])

  return { incidents, loading, error, refresh: load }
}
