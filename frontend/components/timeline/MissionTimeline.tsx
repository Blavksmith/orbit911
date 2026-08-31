'use client'

import type { ZoneRankingItem, Satellite } from '@/lib/types'

interface MissionTimelineProps {
  ranking: ZoneRankingItem[]
  satellites: Satellite[]
  recommendedWildfireId: number | null
}

const ZONE_COLORS: Record<number, string> = {
  1: 'border-red-500 bg-red-950',
  2: 'border-orange-500 bg-orange-950',
  3: 'border-yellow-600 bg-yellow-950',
  4: 'border-slate-600 bg-slate-800',
}

export default function MissionTimeline({
  ranking,
  satellites,
  recommendedWildfireId,
}: MissionTimelineProps) {
  const feasible = ranking.filter((z) => z.feasible)
  const infeasible = ranking.filter((z) => !z.feasible)

  // Build a window-minutes lookup from satellites: best available window per zone
  // Since the backend ranks by feasibility, we approximate using the best
  // available satellite's window for each feasible zone slot.
  const availableSats = satellites.filter((s) => s.is_available && s.observation_window_minutes > 0)
  const windows = feasible.map((zone, idx) => {
    // Use the satellite window from the ranking's feasibility breakdown if >0,
    // otherwise fall back to the best available satellite.
    const fromBreakdown = zone.feasibility_breakdown.window_score
    if (fromBreakdown > 0) {
      // window_score is 0–100 normalised; reverse-engineer minutes from it
      // MAX_WINDOW = 20 min (from feasibility_engine.py)
      const MIN_W = 1, MAX_W = 20
      const approxMinutes = Math.round((fromBreakdown / 100) * (MAX_W - MIN_W) + MIN_W)
      return { zone, windowMins: approxMinutes }
    }
    const sat = availableSats[idx % Math.max(availableSats.length, 1)]
    return { zone, windowMins: sat?.observation_window_minutes ?? 10 }
  })

  let cumulative = 0
  const entries = windows.map(({ zone, windowMins }) => {
    const start = cumulative
    cumulative += windowMins + 5 // 5-min buffer between passes
    return { zone, start, duration: windowMins }
  })

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
      <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
        Mission Timeline
      </h3>

      {/* Timeline track */}
      <div className="relative">
        <div className="absolute left-1.5 top-0 bottom-0 w-px bg-slate-700" />

        <div className="space-y-3">
          {entries.map(({ zone, start, duration }) => {
            const isNext = zone.wildfire_id === recommendedWildfireId
            const colorClass = ZONE_COLORS[zone.rank] ?? 'border-slate-600 bg-slate-800'

            return (
              <div key={zone.wildfire_id} className="flex items-start gap-4">
                {/* Dot */}
                <div className="flex-shrink-0 z-10 mt-1">
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      isNext
                        ? 'border-red-400 bg-red-400'
                        : 'border-slate-500 bg-slate-800'
                    }`}
                  />
                </div>

                {/* Card */}
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
                      <span
                        className={`font-medium ${
                          isNext ? 'text-slate-100' : 'text-slate-300'
                        }`}
                      >
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

          {/* Infeasible zones — muted */}
          {infeasible.map((zone) => (
            <div key={zone.wildfire_id} className="flex items-start gap-4">
              <div className="flex-shrink-0 z-10 mt-1">
                <div className="w-3 h-3 rounded-full border-2 border-slate-700 bg-slate-900" />
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
