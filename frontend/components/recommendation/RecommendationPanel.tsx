'use client'

import { CheckCircle } from 'lucide-react'
import type { RecommendationResponse } from '@/lib/types'
import { MOCK_SATELLITES } from '@/data/mock'

interface RecommendationPanelProps {
  data: RecommendationResponse
}

export default function RecommendationPanel({ data }: RecommendationPanelProps) {
  const rec = data.recommendation
  const assignedSat = MOCK_SATELLITES.find((s) => s.id === 1)

  if (!rec || !data.recommended_target) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded p-4 text-slate-400 text-sm">
        No recommendation available.
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-4">
      {/* OBSERVE NEXT badge + zone name */}
      <div>
        <span className="inline-block bg-red-600 text-white text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded mb-2">
          Observe Next
        </span>
        <h2 className="text-slate-100 text-lg font-semibold leading-tight">
          {data.recommended_target}
        </h2>
      </div>

      {/* Three key metrics */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCell label="Emergency Priority" value={rec.emergency_priority} />
        <MetricCell label="Sat. Feasibility" value={rec.satellite_feasibility} />
        <MetricCell label="Final Score" value={rec.final_score} highlight />
      </div>

      {/* Satellite assignment */}
      {assignedSat && (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
          <span className="text-blue-400 text-sm">✦</span>
          <span className="text-slate-300 text-sm">{assignedSat.name}</span>
          <span className="text-slate-500 text-xs">·</span>
          <span className="text-slate-400 text-xs">{assignedSat.observation_window_minutes} min window</span>
        </div>
      )}

      {/* Action button */}
      <button
        className="w-full mt-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-100 text-sm font-medium py-2 px-4 rounded border border-slate-600 transition-colors flex items-center justify-center gap-2"
        type="button"
      >
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        Confirm Observation
      </button>
    </div>
  )
}

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
    <div className="bg-slate-800 rounded p-3 text-center">
      <div
        className={`text-xl font-bold tabular-nums ${
          highlight ? 'text-blue-400' : 'text-slate-100'
        }`}
      >
        {value.toFixed(2)}
      </div>
      <div className="text-slate-500 text-xs mt-0.5 leading-tight">{label}</div>
    </div>
  )
}
