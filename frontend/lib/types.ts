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
