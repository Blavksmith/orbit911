/**
 * api.ts
 * ======
 * All API calls to the Orbit911 FastAPI backend.
 *
 * Base URL is read from NEXT_PUBLIC_API_BASE_URL (set in .env.local).
 * Falls back to http://localhost:8000 for local development.
 *
 * All functions throw an ApiError on non-2xx responses so callers can
 * distinguish network failures from application errors.
 */

import type {
  Wildfire,
  Satellite,
  RecommendationResponse,
  ObservationConfirmationResponse,
  ChatResponse,
  WhatIfRequest,
  WhatIfResponse,
} from '@/lib/types'

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

// ── Error type ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Shared fetch helper ───────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`
  let res: Response

  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    // Network-level failure (backend not running, CORS, etc.)
    throw new ApiError(0, `Cannot reach backend at ${BASE}. Is the server running?`)
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, detail)
  }

  return res.json() as Promise<T>
}

// ── Wildfire endpoints ────────────────────────────────────────────────────────

export async function getWildfires(): Promise<Wildfire[]> {
  return apiFetch<Wildfire[]>('/api/wildfires')
}

export async function getWildfire(id: number): Promise<Wildfire> {
  return apiFetch<Wildfire>(`/api/wildfires/${id}`)
}

// ── Satellite endpoints ───────────────────────────────────────────────────────

export async function getSatellites(): Promise<Satellite[]> {
  return apiFetch<Satellite[]>('/api/satellites')
}

export async function getSatellite(id: number): Promise<Satellite> {
  return apiFetch<Satellite>(`/api/satellites/${id}`)
}

// ── Recommendation endpoints ──────────────────────────────────────────────────

export async function getRecommendation(): Promise<RecommendationResponse> {
  return apiFetch<RecommendationResponse>('/api/recommendation')
}

export async function recalculate(): Promise<RecommendationResponse> {
  return apiFetch<RecommendationResponse>('/api/recommendation/recalculate', {
    method: 'POST',
  })
}

export async function confirmObservation(
  wildfireId: number,
  satelliteId: number,
): Promise<ObservationConfirmationResponse> {
  return apiFetch<ObservationConfirmationResponse>('/api/recommendation/confirm', {
    method: 'POST',
    body: JSON.stringify({ wildfire_id: wildfireId, satellite_id: satelliteId }),
  })
}

// ── What-If endpoint ─────────────────────────────────────────────────────────

export async function postWhatIf(body: WhatIfRequest): Promise<WhatIfResponse> {
  return apiFetch<WhatIfResponse>('/api/recommendation/what-if', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ── AI chat endpoint ──────────────────────────────────────────────────────────

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}
