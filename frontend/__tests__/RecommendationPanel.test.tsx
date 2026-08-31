import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecommendationPanel from '@/components/recommendation/RecommendationPanel'
import { MOCK_RECOMMENDATION, MOCK_SATELLITES } from '@/data/mock'

describe('RecommendationPanel', () => {
  it('renders the OBSERVE NEXT badge', () => {
    render(<RecommendationPanel data={MOCK_RECOMMENDATION} satellites={MOCK_SATELLITES} />)
    expect(screen.getByText(/observe next/i)).toBeInTheDocument()
  })

  it('displays the recommended zone name', () => {
    render(<RecommendationPanel data={MOCK_RECOMMENDATION} satellites={MOCK_SATELLITES} />)
    expect(screen.getByText('Zone B — Ridgecrest')).toBeInTheDocument()
  })

  it('shows the three key scores', () => {
    render(<RecommendationPanel data={MOCK_RECOMMENDATION} satellites={MOCK_SATELLITES} />)
    // Scores now rendered with .toFixed(1) for cleaner display
    expect(screen.getByText('77.4')).toBeInTheDocument()
    expect(screen.getByText('77.5')).toBeInTheDocument()
    expect(screen.getByText('60.0')).toBeInTheDocument()
  })

  it('renders the confirm button', () => {
    render(<RecommendationPanel data={MOCK_RECOMMENDATION} satellites={MOCK_SATELLITES} />)
    expect(screen.getByRole('button', { name: /confirm observation/i })).toBeInTheDocument()
  })
})
