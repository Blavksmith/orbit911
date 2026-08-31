import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PriorityRanking from '@/components/priority/PriorityRanking'
import { MOCK_RECOMMENDATION } from '@/data/mock'

describe('PriorityRanking', () => {
  it('renders all four zones', () => {
    render(<PriorityRanking ranking={MOCK_RECOMMENDATION.ranking} />)
    expect(screen.getByText('Zone B — Ridgecrest')).toBeInTheDocument()
    expect(screen.getByText('Zone A — Antelope Valley')).toBeInTheDocument()
    expect(screen.getByText('Zone C — Tehachapi')).toBeInTheDocument()
    expect(screen.getByText('Zone D — Mojave Outskirts')).toBeInTheDocument()
  })

  it('marks Zone B as recommended', () => {
    render(<PriorityRanking ranking={MOCK_RECOMMENDATION.ranking} />)
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('marks Zone D as not observable', () => {
    render(<PriorityRanking ranking={MOCK_RECOMMENDATION.ranking} />)
    expect(screen.getByText('Not observable')).toBeInTheDocument()
  })
})
