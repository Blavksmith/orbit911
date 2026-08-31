'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { ZoneRankingItem } from '@/lib/types'

interface WhatIfPanelProps {
  ranking: ZoneRankingItem[]
}

const CONDITIONS = [
  { value: 'unobservable', label: 'becomes unobservable' },
  { value: 'higher_severity', label: 'has higher severity' },
  { value: 'lower_severity', label: 'has lower severity' },
  { value: 'no_satellite', label: 'loses satellite coverage' },
]

export default function WhatIfPanel({ ranking }: WhatIfPanelProps) {
  const feasible = ranking.filter((z) => z.feasible)
  const [selectedZone, setSelectedZone] = useState(feasible[0]?.wildfire_id?.toString() ?? '')
  const [selectedCondition, setSelectedCondition] = useState(CONDITIONS[0].value)
  const [isCalculating, setIsCalculating] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  function handleRecalculate() {
    setIsCalculating(true)
    setResult(null)
    // Simulate async recalculation
    setTimeout(() => {
      setIsCalculating(false)
      const zoneName = ranking.find((z) => z.wildfire_id.toString() === selectedZone)?.wildfire_name ?? 'the zone'
      const condition = CONDITIONS.find((c) => c.value === selectedCondition)?.label ?? ''
      if (selectedCondition === 'unobservable' || selectedCondition === 'no_satellite') {
        const nextBest = ranking.find(
          (z) => z.feasible && z.wildfire_id.toString() !== selectedZone
        )
        setResult(
          nextBest
            ? `If ${zoneName} ${condition}, the system would recommend ${nextBest.wildfire_name} (score: ${nextBest.final_score.toFixed(1)}).`
            : `If ${zoneName} ${condition}, no feasible observation targets remain.`
        )
      } else {
        setResult(
          `If ${zoneName} ${condition}, the priority ranking may shift. Zone B — Ridgecrest would likely remain the top priority given current satellite positioning.`
        )
      }
    }, 800)
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
      <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
        What-If
      </h3>

      {/* Controls */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="text-slate-400 flex-shrink-0">If</span>
          <select
            value={selectedZone}
            onChange={(e) => { setSelectedZone(e.target.value); setResult(null) }}
            className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 flex-1 min-w-0"
          >
            {ranking.filter((z) => z.feasible).map((z) => (
              <option key={z.wildfire_id} value={z.wildfire_id.toString()}>
                {z.wildfire_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-sm flex-wrap">
          <select
            value={selectedCondition}
            onChange={(e) => { setSelectedCondition(e.target.value); setResult(null) }}
            className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 flex-1 min-w-0"
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleRecalculate}
        disabled={isCalculating}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 text-sm font-medium py-1.5 px-4 rounded border border-slate-600 transition-colors flex items-center justify-center gap-2"
        type="button"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
        Recalculate
      </button>

      {/* Result */}
      {isCalculating && (
        <p className="text-slate-400 text-xs italic">Recalculating…</p>
      )}
      {result && (
        <div className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-300 leading-relaxed">
          {result}
        </div>
      )}
    </div>
  )
}
