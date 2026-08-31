export interface Wildfire {
  id: number
  name: string
  latitude: number
  longitude: number
  severity: number
  fire_growth_rate: number
  detection_recency_hours: number
  population_exposed: number
  hospital_risk: number
  critical_infrastructure_risk: number
  created_at: string
  updated_at: string
}

export interface Satellite {
  id: number
  name: string
  latitude: number
  longitude: number
  is_available: boolean
  visibility_score: number
  observation_window_minutes: number
  battery_level: number
  created_at: string
  updated_at: string
}

export interface ObservationOpportunity {
  id: number
  wildfire_id: number
  satellite_id: number
  visibility_score: number
  observation_window_minutes: number
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface PriorityBreakdown {
  human_impact: number
  fire_severity: number
  urgency: number
  infrastructure: number
  time_sensitivity: number
}

export interface FeasibilityBreakdown {
  visibility_score: number
  window_score: number
  availability_score: number
}

export interface ZoneRankingItem {
  rank: number
  wildfire_id: number
  wildfire_name: string
  emergency_priority: number
  satellite_feasibility: number
  final_score: number
  feasible: boolean
  is_recommended: boolean
  reasons: string[]
  priority_breakdown: PriorityBreakdown
  feasibility_breakdown: FeasibilityBreakdown
}

export interface RecommendationDetail {
  emergency_priority: number
  satellite_feasibility: number
  final_score: number
  reasons: string[]
}

export interface RecommendationResponse {
  recommended_target: string | null
  recommended_wildfire_id: number | null
  recommendation: RecommendationDetail | null
  ranking: ZoneRankingItem[]
  total_zones: number
  feasible_zones: number
}

// ── AI chat ───────────────────────────────────────────────────────────────────

export interface ChatResponse {
  response: string
}

// ── What-If request (matches backend WhatIfRequest schema exactly) ────────────

export interface WildfireOverride {
  severity?: number | null
  fire_growth_rate?: number | null
  detection_recency_hours?: number | null
  population_exposed?: number | null
  hospital_risk?: number | null
  critical_infrastructure_risk?: number | null
}

export interface OpportunityOverride {
  visibility_score?: number | null
  observation_window_minutes?: number | null
  is_available?: boolean | null
}

export interface ZoneOverride {
  wildfire?: WildfireOverride | null
  opportunity?: OpportunityOverride | null
}

export interface WhatIfRequest {
  /** Map of wildfire_id (as string) → ZoneOverride */
  overrides: Record<string, ZoneOverride>
}

// ── What-If response (matches backend WhatIfResponse schema exactly) ──────────

export interface ScoreChange {
  wildfire_id: number
  wildfire_name: string
  original_emergency_priority: number
  new_emergency_priority: number
  original_satellite_feasibility: number
  new_satellite_feasibility: number
  original_final_score: number
  new_final_score: number
  original_feasible: boolean
  new_feasible: boolean
}

export interface WhatIfResponse {
  original_recommendation: string | null
  original_wildfire_id: number | null
  new_recommendation: string | null
  new_wildfire_id: number | null
  recommendation_changed: boolean
  original_ranking: ZoneRankingItem[]
  new_ranking: ZoneRankingItem[]
  changes: string[]
  reasons: string[]
  score_changes: ScoreChange[]
}

// ── Dashboard loading state ───────────────────────────────────────────────────

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

export interface DashboardState {
  wildfires: Wildfire[]
  satellites: Satellite[]
  recommendation: RecommendationResponse | null
  status: LoadStatus
  error: string | null
}
