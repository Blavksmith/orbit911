'use client'

import type { ZoneRankingItem } from '@/lib/types'

interface PriorityRankingProps {
  ranking: ZoneRankingItem[]
  selectedWildfireId: number | null
  onSelectWildfire: (wildfireId: number) => void
}

function severityDot(score: number): string {
  if (score >= 55) return 'bg-red-500'
  if (score >= 40) return 'bg-orange-500'
  if (score >= 25) return 'bg-yellow-500'
  return 'bg-slate-500'
}

export default function PriorityRanking({
  ranking,
  selectedWildfireId,
  onSelectWildfire,
}: PriorityRankingProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-1">
      <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        Priority Ranking
      </h3>

      {ranking.length === 0 ? (
        <p className="text-slate-500 text-xs">No zones available.</p>
      ) : (
        <div className="space-y-1.5">
          {ranking.map((zone) => (
            <button
              key={zone.wildfire_id}
              type="button"
              aria-label={`Select ${zone.wildfire_name}`}
              aria-pressed={zone.wildfire_id === selectedWildfireId}
              onClick={() => onSelectWildfire(zone.wildfire_id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/70 ${
                zone.wildfire_id === selectedWildfireId
                  ? 'bg-blue-950/40 border border-blue-700/70 ring-1 ring-blue-700/40'
                  : zone.is_recommended
                  ? 'bg-slate-800 border border-red-900/60 ring-1 ring-red-900/40'
                  : 'hover:bg-slate-800/50 border border-transparent'
              } ${!zone.feasible ? 'opacity-60' : ''}`}
            >
              {/* Rank badge */}
              <span
                className={`text-xs font-mono w-5 h-5 flex items-center justify-center rounded flex-shrink-0 ${
                  zone.rank === 1 && zone.feasible
                    ? 'bg-red-900/70 text-red-300 font-bold'
                    : 'text-slate-500'
                }`}
              >
                {zone.rank}
              </span>

              {/* Severity dot */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  zone.feasible ? severityDot(zone.final_score) : 'bg-slate-700'
                }`}
              />

              {/* Zone info */}
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium truncate ${
                    zone.feasible ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  {zone.wildfire_name}
                </div>
                {zone.is_recommended && (
                  <span className="text-red-400 text-[10px] font-semibold uppercase tracking-wide">
                    ● Recommended
                  </span>
                )}
                {!zone.feasible && (
                  <span className="text-slate-600 text-[10px] uppercase tracking-wide">
                    Not observable
                  </span>
                )}
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                {zone.feasible ? (
                  <div>
                    <span className="text-blue-400 font-mono text-sm tabular-nums font-semibold">
                      {zone.final_score.toFixed(1)}
                    </span>
                    <span className="text-slate-600 text-[10px]"> /100</span>
                  </div>
                ) : (
                  <span className="text-slate-700 font-mono text-sm">—</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
