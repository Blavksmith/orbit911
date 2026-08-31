'use client'

import { CheckCircle, Satellite } from 'lucide-react'
import type { RecommendationResponse, Satellite as SatelliteType } from '@/lib/types'

interface RecommendationPanelProps {
  data: RecommendationResponse
  satellites: SatelliteType[]
  /** True when showing a What-If scenario rather than live data */
  isWhatIf?: boolean
}

export default function RecommendationPanel({ data, satellites, isWhatIf }: RecommendationPanelProps) {
  const rec = data.recommendation

  // Find the best available satellite (highest visibility among available ones)
  const assignedSat = satellites
    .filter((s) => s.is_available && s.observation_window_minutes > 0)
    .sort((a, b) => b.visibility_score - a.visibility_score)[0] ?? null

  if (!rec || !data.recommended_target) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded p-4 text-slate-400 text-sm">
        No recommendation available.
      </div>
    )
  }

  return (
    <div
      className={`rounded border p-4 space-y-4 ${
        isWhatIf
          ? 'bg-orange-950/30 border-orange-800'
          : 'bg-slate-900 border-slate-700'
      }`}
    >
      {/* OBSERVE NEXT hero block */}
      <div>
        {/* Badge */}
        <div className="mb-2">
          <span
            className={`inline-block text-white text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded ${
              isWhatIf ? 'bg-orange-600' : 'bg-red-600'
            }`}
          >
            {isWhatIf ? '⚡ What-If Result' : '🚨 Observe Next'}
          </span>
        </div>

        {/* Zone name — most prominent text on page */}
        <h2 className="text-slate-100 text-2xl font-bold leading-tight tracking-tight">
          {data.recommended_target}
        </h2>

        {/* Subtitle context */}
        <p className="text-slate-400 text-xs mt-1">
          Highest-priority observable wildfire zone
        </p>
      </div>

      {/* Three key metrics */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCell label="Emergency Priority" value={rec.emergency_priority} />
        <MetricCell label="Sat. Feasibility" value={rec.satellite_feasibility} />
        <MetricCell label="Final Score" value={rec.final_score} highlight />
      </div>

      {/* Satellite assignment */}
      {assignedSat && (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-700/60">
          <Satellite className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" strokeWidth={1.5} />
          <span className="text-slate-300 text-sm font-medium">{assignedSat.name}</span>
          <span className="text-slate-500 text-xs">·</span>
          <span className="text-slate-400 text-xs">
            {assignedSat.observation_window_minutes} min window
          </span>
        </div>
      )}

      {/* Confirm button */}
      <button
        aria-label={`Confirm observation of ${data.recommended_target}`}
        className="w-full mt-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-100 text-sm font-medium py-2 px-4 rounded border border-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 flex items-center justify-center gap-2"
        type="button"
      >
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        Confirm Observation
      </button>
    </div>
  )
}

// ── MetricCell ────────────────────────────────────────────────────────────────

function MetricCell({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="bg-slate-800 rounded p-2.5 text-center">
      <div
        className={`text-lg font-bold tabular-nums leading-none ${
          highlight ? 'text-blue-400' : 'text-slate-100'
        }`}
      >
        {value.toFixed(1)}
      </div>
      <div className="text-slate-500 text-[10px] mt-1 leading-tight">{label}</div>
      <div className="text-slate-600 text-[9px] mt-0.5">/100</div>
    </div>
  )
}
