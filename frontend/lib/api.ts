import type { RecommendationResponse, Wildfire, Satellite } from '@/lib/types'
import { MOCK_RECOMMENDATION, MOCK_WILDFIRES, MOCK_SATELLITES } from '@/data/mock'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// Phase 1: All functions return mock data.
// Phase 2: Replace with real fetch calls to the FastAPI backend.

export async function getRecommendation(): Promise<RecommendationResponse> {
  // Phase 2: return fetch(`${API_BASE}/recommend`).then(r => r.json())
  void API_BASE
  return Promise.resolve(MOCK_RECOMMENDATION)
}

export async function getWildfires(): Promise<Wildfire[]> {
  // Phase 2: return fetch(`${API_BASE}/wildfires`).then(r => r.json())
  return Promise.resolve(MOCK_WILDFIRES)
}

export async function getSatellites(): Promise<Satellite[]> {
  // Phase 2: return fetch(`${API_BASE}/satellites`).then(r => r.json())
  return Promise.resolve(MOCK_SATELLITES)
}
