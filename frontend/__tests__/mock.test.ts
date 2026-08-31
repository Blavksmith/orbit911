import { describe, it, expect } from 'vitest'
import { MOCK_RECOMMENDATION, MOCK_WILDFIRES, MOCK_SATELLITES } from '@/data/mock'

describe('Mock data integrity', () => {
  it('has 4 wildfires', () => {
    expect(MOCK_WILDFIRES).toHaveLength(4)
  })

  it('has 3 satellites', () => {
    expect(MOCK_SATELLITES).toHaveLength(3)
  })

  it('recommendation points to wildfire id 1', () => {
    expect(MOCK_RECOMMENDATION.recommended_wildfire_id).toBe(1)
  })

  it('ranking has 4 items', () => {
    expect(MOCK_RECOMMENDATION.ranking).toHaveLength(4)
  })

  it('Zone D is infeasible', () => {
    const zoneD = MOCK_RECOMMENDATION.ranking.find((z) => z.wildfire_id === 4)
    expect(zoneD?.feasible).toBe(false)
    expect(zoneD?.final_score).toBe(0)
  })

  it('Zone B has the highest final score', () => {
    const ranked = [...MOCK_RECOMMENDATION.ranking].sort((a, b) => b.final_score - a.final_score)
    expect(ranked[0].wildfire_id).toBe(1)
  })
})
