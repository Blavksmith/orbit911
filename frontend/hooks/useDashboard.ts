'use client'

/**
 * useDashboard
 * ============
 * Fetches wildfires, satellites, and recommendation in parallel from the
 * FastAPI backend.  Returns a single DashboardState so Dashboard.tsx only
 * needs one hook.
 *
 * Falls back gracefully: if the backend is unreachable the dashboard shows
 * a clear error state rather than crashing.
 */

import { useCallback, useEffect, useState } from 'react'
import { getWildfires, getSatellites, getRecommendation, ApiError } from '@/lib/api'
import type { DashboardState } from '@/lib/types'

const INITIAL_STATE: DashboardState = {
  wildfires: [],
  satellites: [],
  recommendation: null,
  status: 'idle',
  error: null,
}

export function useDashboard() {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: null }))

    try {
      // All three fetches run in parallel for speed
      const [wildfires, satellites, recommendation] = await Promise.all([
        getWildfires(),
        getSatellites(),
        getRecommendation(),
      ])

      setState({
        wildfires,
        satellites,
        recommendation,
        status: 'success',
        error: null,
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unexpected error loading dashboard data.'

      setState((s) => ({
        ...s,
        status: 'error',
        error: message,
      }))
    }
  }, [])

  // Load on mount
  useEffect(() => {
    load()
  }, [load])

  return { ...state, reload: load }
}
