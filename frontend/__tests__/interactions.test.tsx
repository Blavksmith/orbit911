import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import WhatIfPanel from '@/components/whatif/WhatIfPanel'
import AICopilot from '@/components/ai/AICopilot'
import { MOCK_RECOMMENDATION } from '@/data/mock'
import * as api from '@/lib/api'

// jsdom does not implement scrollIntoView — mock it globally
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

// ── Mock the API module ───────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  postWhatIf: vi.fn(),
  sendChatMessage: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message)
      this.name = 'ApiError'
    }
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const ranking = MOCK_RECOMMENDATION.ranking

function makeWhatIfResult(changed = true) {
  return {
    original_recommendation: 'Zone B — Ridgecrest',
    original_wildfire_id: 1,
    new_recommendation: changed ? 'Zone A — Antelope Valley' : 'Zone B — Ridgecrest',
    new_wildfire_id: changed ? 2 : 1,
    recommendation_changed: changed,
    original_ranking: ranking,
    new_ranking: ranking,
    changes: changed ? ['Zone B is now unobservable'] : [],
    reasons: changed ? ['Zone B no longer has satellite coverage'] : [],
    score_changes: [
      {
        wildfire_id: 1,
        wildfire_name: 'Zone B — Ridgecrest',
        original_emergency_priority: 77.42,
        new_emergency_priority: 77.42,
        original_satellite_feasibility: 77.5,
        new_satellite_feasibility: changed ? 0 : 77.5,
        original_final_score: 59.99,
        new_final_score: changed ? 0 : 59.99,
        original_feasible: true,
        new_feasible: !changed,
      },
    ],
  }
}

// ── WhatIfPanel tests ─────────────────────────────────────────────────────────

describe('WhatIfPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the What-If Simulator heading', () => {
    render(<WhatIfPanel ranking={ranking} />)
    expect(screen.getByText(/what-if simulator/i)).toBeInTheDocument()
  })

  it('renders the Recalculate button', () => {
    render(<WhatIfPanel ranking={ranking} />)
    expect(screen.getByRole('button', { name: /run what-if recalculation/i })).toBeInTheDocument()
  })

  it('renders zone and condition selects', () => {
    render(<WhatIfPanel ranking={ranking} />)
    expect(screen.getByLabelText(/select wildfire zone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/select condition/i)).toBeInTheDocument()
  })

  it('populates zone dropdown with all ranking items', () => {
    render(<WhatIfPanel ranking={ranking} />)
    const select = screen.getByLabelText(/select wildfire zone/i) as HTMLSelectElement
    expect(select.options).toHaveLength(4)
    expect(select.options[0].text).toBe('Zone B — Ridgecrest')
    expect(select.options[3].text).toBe('Zone D — Mojave Outskirts')
  })

  it('calls postWhatIf and shows "Recommendation Changed" on success', async () => {
    vi.mocked(api.postWhatIf).mockResolvedValue(makeWhatIfResult(true))

    render(<WhatIfPanel ranking={ranking} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run what-if recalculation/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/recommendation changed/i)).toBeInTheDocument()
    })
    expect(api.postWhatIf).toHaveBeenCalledTimes(1)
  })

  it('shows "Recommendation Unchanged" when result did not change', async () => {
    vi.mocked(api.postWhatIf).mockResolvedValue(makeWhatIfResult(false))

    render(<WhatIfPanel ranking={ranking} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run what-if recalculation/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/recommendation unchanged/i)).toBeInTheDocument()
    })
  })

  it('shows ApiError message when postWhatIf fails', async () => {
    vi.mocked(api.postWhatIf).mockRejectedValue(
      new api.ApiError(500, 'Internal server error')
    )

    render(<WhatIfPanel ranking={ranking} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run what-if recalculation/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/internal server error/i)).toBeInTheDocument()
    })
  })

  it('shows fallback error when network fails', async () => {
    vi.mocked(api.postWhatIf).mockRejectedValue(new Error('Network error'))

    render(<WhatIfPanel ranking={ranking} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run what-if recalculation/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/recalculation failed/i)).toBeInTheDocument()
    })
  })

  it('fires onNewRecommendation callback with the result', async () => {
    const result = makeWhatIfResult(true)
    vi.mocked(api.postWhatIf).mockResolvedValue(result)
    const callback = vi.fn()

    render(<WhatIfPanel ranking={ranking} onNewRecommendation={callback} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run what-if recalculation/i }))
    })

    await waitFor(() => expect(callback).toHaveBeenCalledWith(result))
  })
})

// ── AICopilot tests ───────────────────────────────────────────────────────────

describe('AICopilot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the AI Copilot label', () => {
    render(<AICopilot />)
    expect(screen.getByText(/ai copilot/i)).toBeInTheDocument()
  })

  it('renders suggested question chips', () => {
    render(<AICopilot />)
    expect(screen.getByLabelText(/ask: why was zone b selected/i)).toBeInTheDocument()
  })

  it('renders the message input', () => {
    render(<AICopilot />)
    expect(screen.getByLabelText(/ai copilot input/i)).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<AICopilot />)
    const btn = screen.getByRole('button', { name: /send message/i })
    expect(btn).toBeDisabled()
  })

  it('sends message via Enter key and shows response', async () => {
    vi.mocked(api.sendChatMessage).mockResolvedValue({
      response: 'Zone B has the highest emergency priority.',
    })

    render(<AICopilot />)
    const input = screen.getByLabelText(/ai copilot input/i)

    fireEvent.change(input, { target: { value: 'Why Zone B?' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText(/zone b has the highest emergency priority/i)).toBeInTheDocument()
    })
    expect(api.sendChatMessage).toHaveBeenCalledWith('Why Zone B?')
  })

  it('shows ApiError message in the chat when AI call fails', async () => {
    vi.mocked(api.sendChatMessage).mockRejectedValue(
      new api.ApiError(503, 'Service unavailable')
    )

    render(<AICopilot />)
    const input = screen.getByLabelText(/ai copilot input/i)
    fireEvent.change(input, { target: { value: 'Hello' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText(/service unavailable/i)).toBeInTheDocument()
    })
  })

  it('shows GEMINI_API_KEY hint when generic network error occurs', async () => {
    vi.mocked(api.sendChatMessage).mockRejectedValue(new Error('Failed to fetch'))

    render(<AICopilot />)
    const input = screen.getByLabelText(/ai copilot input/i)
    fireEvent.change(input, { target: { value: 'Hello' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText(/GEMINI_API_KEY/i)).toBeInTheDocument()
    })
  })
})
