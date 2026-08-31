'use client'

import type { ZoneRankingItem } from '@/lib/types'

interface PriorityRankingProps {
  ranking: ZoneRankingItem[]
}

function severityColor(score: number): string {
  if (score >= 55) return 'bg-red-500'
  if (score >= 40) return 'bg-orange-500'
  if (score >= 25) return 'bg-yellow-500'
  return 'bg-slate-500'
}

export default function PriorityRanking({ ranking }: PriorityRankingProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-1">
      <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        Priority Ranking
      </h3>
      <div className="space-y-1">
        {ranking.map((zone) => (
          <div
            key={zone.rank}
            className={`flex items-center gap-3 px-3 py-2 rounded text-sm ${
              zone.is_recommended
                ? 'bg-slate-800 border border-slate-600'
                : 'hover:bg-slate-800/50'
            }`}
          >
            {/* Rank number */}
            <span className="text-slate-500 text-xs font-mono w-4 text-center flex-shrink-0">
              {zone.rank}
            </span>

            {/* Severity bar */}
            <div className="w-1 h-8 rounded-full flex-shrink-0 flex flex-col items-center">
              <div
                className={`w-1 rounded-full ${severityColor(zone.final_score)}`}
                style={{ height: zone.feasible ? `${Math.max(16, (zone.final_score / 100) * 32)}px` : '16px' }}
              />
            </div>

            {/* Zone name */}
            <div className="flex-1 min-w-0">
              <div className={`font-medium truncate ${zone.feasible ? 'text-slate-200' : 'text-slate-500'}`}>
                {zone.wildfire_name}
              </div>
              {zone.is_recommended && (
                <span className="text-red-400 text-xs font-semibold uppercase tracking-wide">
                  Recommended
                </span>
              )}
              {!zone.feasible && (
                <span className="text-slate-500 text-xs uppercase tracking-wide">
                  Not observable
                </span>
              )}
            </div>

            {/* Score */}
            <div className="text-right flex-shrink-0">
              {zone.feasible ? (
                <span className="text-blue-400 font-mono text-sm tabular-nums">
                  {zone.final_score.toFixed(1)}
                </span>
              ) : (
                <span className="text-slate-600 font-mono text-sm">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
