'use client'

import type { ZoneRankingItem } from '@/lib/types'

interface MissionTimelineProps {
  ranking: ZoneRankingItem[]
  recommendedWildfireId: number | null
}

const ZONE_WINDOWS: Record<number, number> = {
  1: 12,
  2: 18,
  3: 0,
  4: 0,
}

const ZONE_COLORS: Record<number, string> = {
  1: 'border-red-500 bg-red-950',
  2: 'border-orange-500 bg-orange-950',
  3: 'border-yellow-600 bg-yellow-950',
  4: 'border-slate-600 bg-slate-800',
}

export default function MissionTimeline({ ranking, recommendedWildfireId }: MissionTimelineProps) {
  const feasible = ranking.filter((z) => z.feasible)
  const infeasible = ranking.filter((z) => !z.feasible)

  // Lay out timeline starting from T+0
  let cumulativeMinutes = 0
  const entries = feasible.map((zone, idx) => {
    const windowMins = ZONE_WINDOWS[zone.wildfire_id] ?? 10
    const start = cumulativeMinutes
    cumulativeMinutes += windowMins + 5 // 5 min buffer between windows
    return { zone, start, duration: windowMins, idx }
  })

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
      <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
        Mission Timeline
      </h3>

      {/* Timeline track */}
      <div className="relative">
        {/* Track line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-700" />

        <div className="space-y-3">
          {entries.map(({ zone, start, duration }) => {
            const isNext = zone.wildfire_id === recommendedWildfireId
            const colorClass = ZONE_COLORS[zone.wildfire_id] ?? 'border-slate-600 bg-slate-800'

            return (
              <div key={zone.wildfire_id} className="flex items-start gap-4 pl-0">
                {/* Timeline dot */}
                <div className="flex flex-col items-center flex-shrink-0 z-10">
                  <div
                    className={`w-3 h-3 rounded-full border-2 mt-1 ${
                      isNext ? 'border-red-400 bg-red-400' : 'border-slate-500 bg-slate-800'
                    }`}
                  />
                </div>

                {/* Content */}
                <div
                  className={`flex-1 border rounded px-3 py-2 text-sm ${colorClass} ${
                    isNext ? 'border-red-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isNext && (
                        <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">
                          NEXT
                        </span>
                      )}
                      <span className={`font-medium ${isNext ? 'text-slate-100' : 'text-slate-300'}`}>
                        {zone.wildfire_name}
                      </span>
                    </div>
                    <span className="text-slate-500 text-xs font-mono flex-shrink-0">
                      T+{start}m
                    </span>
                  </div>
                  <div className="text-slate-500 text-xs mt-0.5">
                    {duration} min observation window
                  </div>
                </div>
              </div>
            )
          })}

          {/* Infeasible zones */}
          {infeasible.map((zone) => (
            <div key={zone.wildfire_id} className="flex items-start gap-4 pl-0">
              <div className="flex flex-col items-center flex-shrink-0 z-10">
                <div className="w-3 h-3 rounded-full border-2 border-slate-700 bg-slate-900 mt-1" />
              </div>
              <div className="flex-1 border border-slate-700 rounded px-3 py-2 text-sm bg-slate-900 opacity-50">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{zone.wildfire_name}</span>
                  <span className="text-slate-600 text-xs uppercase">No window</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
