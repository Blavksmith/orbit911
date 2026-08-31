'use client'

import { useState } from 'react'
import { RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react'
import { postWhatIf, ApiError } from '@/lib/api'
import type {
  ZoneRankingItem,
  WhatIfRequest,
  WhatIfResponse,
} from '@/lib/types'

// ── Condition definitions ─────────────────────────────────────────────────────
// Each condition maps to a specific override sent to POST /api/recommendation/what-if
// The backend does all scoring — the frontend only describes the change.

interface Condition {
  value: string
  label: string
  buildOverride: (wildfireId: string) => WhatIfRequest
}

const CONDITIONS: Condition[] = [
  {
    value: 'unobservable',
    label: 'becomes unobservable',
    buildOverride: (id) => ({
      overrides: {
        [id]: { opportunity: { is_available: false, observation_window_minutes: 0 } },
      },
    }),
  },
  {
    value: 'higher_severity',
    label: 'has maximum severity',
    buildOverride: (id) => ({
      overrides: {
        [id]: { wildfire: { severity: 100, fire_growth_rate: 100 } },
      },
    }),
  },
  {
    value: 'lower_severity',
    label: 'drops to low severity',
    buildOverride: (id) => ({
      overrides: {
        [id]: { wildfire: { severity: 10, fire_growth_rate: 10 } },
      },
    }),
  },
  {
    value: 'hospital_risk',
    label: 'has maximum hospital risk',
    buildOverride: (id) => ({
      overrides: {
        [id]: { wildfire: { hospital_risk: 100, critical_infrastructure_risk: 100 } },
      },
    }),
  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface WhatIfPanelProps {
  ranking: ZoneRankingItem[]
  /** Called when a recalculation produces a new recommendation */
  onNewRecommendation?: (result: WhatIfResponse) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WhatIfPanel({ ranking, onNewRecommendation }: WhatIfPanelProps) {
  const allZones = ranking
  const [selectedZoneId, setSelectedZoneId] = useState(
    allZones[0]?.wildfire_id?.toString() ?? ''
  )
  const [selectedCondition, setSelectedCondition] = useState(CONDITIONS[0].value)
  const [isCalculating, setIsCalculating] = useState(false)
  const [result, setResult] = useState<WhatIfResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  function resetResult() {
    setResult(null)
    setError(null)
  }

  async function handleRecalculate() {
    if (!selectedZoneId) return
    const condition = CONDITIONS.find((c) => c.value === selectedCondition)
    if (!condition) return

    setIsCalculating(true)
    resetResult()

    try {
      const body = condition.buildOverride(selectedZoneId)
      const data = await postWhatIf(body)
      setResult(data)
      onNewRecommendation?.(data)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Recalculation failed. Is the backend running?'
      )
    } finally {
      setIsCalculating(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
      <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
        What-If
      </h3>

      {/* ── Controls ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs flex-shrink-0">If</span>
          <select
            value={selectedZoneId}
            onChange={(e) => { setSelectedZoneId(e.target.value); resetResult() }}
            className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 min-w-0 focus:outline-none focus:border-slate-500"
          >
            {allZones.map((z) => (
              <option key={z.wildfire_id} value={z.wildfire_id.toString()}>
                {z.wildfire_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCondition}
            onChange={(e) => { setSelectedCondition(e.target.value); resetResult() }}
            className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 min-w-0 focus:outline-none focus:border-slate-500"
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Recalculate button ── */}
      <button
        onClick={handleRecalculate}
        disabled={isCalculating || !selectedZoneId}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 text-sm font-medium py-1.5 px-4 rounded border border-slate-600 transition-colors flex items-center justify-center gap-2"
        type="button"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
        {isCalculating ? 'Recalculating…' : 'Recalculate'}
      </button>

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-start gap-2 bg-red-950/50 border border-red-800 rounded px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {/* ── Result: before / after comparison ── */}
      {result && <WhatIfResult result={result} />}
    </div>
  )
}

// ── WhatIfResult sub-component ────────────────────────────────────────────────

function WhatIfResult({ result }: { result: WhatIfResponse }) {
  const changed = result.recommendation_changed

  return (
    <div className="space-y-3 pt-1">
      {/* Before → After */}
      <div className="bg-slate-800 border border-slate-600 rounded p-3 space-y-2">

        {/* Label row */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium uppercase tracking-wide">
          <span>Before</span>
          <ArrowRight className="w-3 h-3" />
          <span>After</span>
        </div>

        {/* Zone names */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-300 text-xs font-medium truncate flex-1">
            {result.original_recommendation ?? 'None'}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
          <span
            className={`text-xs font-semibold truncate flex-1 text-right ${
              changed ? 'text-orange-300' : 'text-emerald-400'
            }`}
          >
            {result.new_recommendation ?? 'None'}
          </span>
        </div>

        {/* Changed / unchanged badge */}
        <div className="pt-0.5">
          {changed ? (
            <span className="inline-block bg-orange-900/60 border border-orange-700 text-orange-300 text-xs px-2 py-0.5 rounded">
              Recommendation changed
            </span>
          ) : (
            <span className="inline-block bg-emerald-900/40 border border-emerald-800 text-emerald-400 text-xs px-2 py-0.5 rounded">
              Recommendation unchanged
            </span>
          )}
        </div>
      </div>

      {/* Score delta — only for the zone that changed */}
      {result.score_changes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-slate-500 text-xs uppercase tracking-wide font-medium">Score impact</p>
          {result.score_changes.map((sc) => (
            <ScoreDeltaRow key={sc.wildfire_id} change={sc} />
          ))}
        </div>
      )}

      {/* Reasons from backend */}
      {result.reasons.length > 0 && (
        <div className="space-y-1">
          <p className="text-slate-500 text-xs uppercase tracking-wide font-medium">Why</p>
          <ul className="space-y-1">
            {result.reasons.map((r, i) => (
              <li key={i} className="text-slate-400 text-xs leading-relaxed flex gap-1.5">
                <span className="text-slate-600 flex-shrink-0">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── ScoreDeltaRow ─────────────────────────────────────────────────────────────

function ScoreDeltaRow({ change }: { change: import('@/lib/types').ScoreChange }) {
  const delta = change.new_final_score - change.original_final_score
  const isDown = delta < 0
  const isUp = delta > 0
  const deltaStr = delta === 0
    ? '±0'
    : `${isUp ? '+' : ''}${delta.toFixed(1)}`

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-300 text-xs truncate flex-1">{change.wildfire_name}</span>
        {!change.new_feasible && change.original_feasible ? (
          <span className="text-slate-500 text-xs uppercase tracking-wide">
            Not observable
          </span>
        ) : (
          <span
            className={`text-xs font-mono font-semibold tabular-nums ${
              isDown ? 'text-red-400' : isUp ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {change.original_final_score.toFixed(1)} → {change.new_final_score.toFixed(1)}
            <span className="ml-1.5 font-normal opacity-70">({deltaStr})</span>
          </span>
        )}
      </div>
    </div>
  )
}
