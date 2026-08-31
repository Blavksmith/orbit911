import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PriorityRanking from '@/components/priority/PriorityRanking'
import { MOCK_RECOMMENDATION } from '@/data/mock'

describe('PriorityRanking', () => {
  const onSelectWildfire = vi.fn()

  it('renders all four zones', () => {
    render(<PriorityRanking ranking={MOCK_RECOMMENDATION.ranking} selectedWildfireId={1} onSelectWildfire={onSelectWildfire} />)
    expect(screen.getByText('Zone B — Ridgecrest')).toBeInTheDocument()
    expect(screen.getByText('Zone A — Antelope Valley')).toBeInTheDocument()
    expect(screen.getByText('Zone C — Tehachapi')).toBeInTheDocument()
    expect(screen.getByText('Zone D — Mojave Outskirts')).toBeInTheDocument()
  })

  it('marks Zone B as recommended', () => {
    render(<PriorityRanking ranking={MOCK_RECOMMENDATION.ranking} selectedWildfireId={1} onSelectWildfire={onSelectWildfire} />)
    expect(screen.getByText('● Recommended')).toBeInTheDocument()
  })

  it('marks Zone D as not observable', () => {
    render(<PriorityRanking ranking={MOCK_RECOMMENDATION.ranking} selectedWildfireId={1} onSelectWildfire={onSelectWildfire} />)
    expect(screen.getByText('Not observable')).toBeInTheDocument()
  })

  it('selects a zone from the ranking without removing the recommended label', () => {
    render(<PriorityRanking ranking={MOCK_RECOMMENDATION.ranking} selectedWildfireId={1} onSelectWildfire={onSelectWildfire} />)

    fireEvent.click(screen.getByRole('button', { name: /select zone a/i }))

    expect(onSelectWildfire).toHaveBeenCalledWith(2)
    expect(screen.getByText('● Recommended')).toBeInTheDocument()
  })
})
