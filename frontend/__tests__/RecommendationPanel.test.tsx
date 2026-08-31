import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import RecommendationPanel from '@/components/recommendation/RecommendationPanel'
import { MOCK_RECOMMENDATION, MOCK_SATELLITES } from '@/data/mock'
import { confirmObservation } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  confirmObservation: vi.fn().mockResolvedValue({ status: 'confirmed' }),
  ApiError: class ApiError extends Error {},
}))

describe('RecommendationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(confirmObservation).mockResolvedValue({
      status: 'confirmed',
      wildfire_id: 1,
      satellite_id: 1,
      message: 'Observation confirmed and queued.',
    })
  })

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

  it('confirms and queues the observation', async () => {
    render(<RecommendationPanel data={MOCK_RECOMMENDATION} satellites={MOCK_SATELLITES} />)

    fireEvent.click(screen.getByRole('button', { name: /confirm observation/i }))

    await waitFor(() => {
      expect(screen.getByText(/^✓ Observation Confirmed$/)).toBeInTheDocument()
    })
    expect(confirmObservation).toHaveBeenCalledWith(1, 1)
    expect(screen.getByRole('button', { name: /confirm observation/i })).toBeDisabled()
    expect(screen.getByText(/status: queued/i)).toBeInTheDocument()
  })

  it('disables immediately and sends only one request for duplicate clicks', async () => {
    let resolveConfirmation: () => void
    const pendingConfirmation = new Promise<void>((resolve) => {
      resolveConfirmation = resolve
    })
    vi.mocked(confirmObservation).mockReturnValueOnce(pendingConfirmation as never)
    render(<RecommendationPanel data={MOCK_RECOMMENDATION} satellites={MOCK_SATELLITES} />)

    const button = screen.getByRole('button', { name: /confirm observation/i })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(/confirming observation/i)
    expect(confirmObservation).toHaveBeenCalledTimes(1)

    resolveConfirmation!()
    await screen.findByText(/status: queued/i)
  })

  it('shows a friendly error when confirmation fails', async () => {
    vi.mocked(confirmObservation).mockRejectedValueOnce(new Error('Request failed'))
    render(<RecommendationPanel data={MOCK_RECOMMENDATION} satellites={MOCK_SATELLITES} />)

    fireEvent.click(screen.getByRole('button', { name: /confirm observation/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to confirm/i)
  })

  it('shows the selected zone scores while retaining confirmation for the recommended target', () => {
    const selectedZone = MOCK_RECOMMENDATION.ranking[1]
    render(
      <RecommendationPanel
        data={MOCK_RECOMMENDATION}
        satellites={MOCK_SATELLITES}
        selectedZone={selectedZone}
      />,
    )

    expect(screen.getByText('Zone A — Antelope Valley')).toBeInTheDocument()
    expect(screen.getByText('55.3')).toBeInTheDocument()
    expect(screen.getByText('72.0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm observation of zone a/i })).toBeDisabled()
    expect(screen.getByText(/recommended target required/i)).toBeInTheDocument()
  })

  it('resets the confirmation state when the recommendation changes', async () => {
    const { rerender } = render(
      <RecommendationPanel data={MOCK_RECOMMENDATION} satellites={MOCK_SATELLITES} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /confirm observation/i }))
    await screen.findByText(/^✓ Observation Confirmed$/)

    rerender(
      <RecommendationPanel
        data={{
          ...MOCK_RECOMMENDATION,
          recommended_target: 'Zone A — Antelope Valley',
          recommended_wildfire_id: 2,
          ranking: MOCK_RECOMMENDATION.ranking.map((zone) => ({
            ...zone,
            is_recommended: zone.wildfire_id === 2,
          })),
        }}
        satellites={MOCK_SATELLITES}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/observe next/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /confirm observation of zone a/i })).toBeEnabled()
  })
})
