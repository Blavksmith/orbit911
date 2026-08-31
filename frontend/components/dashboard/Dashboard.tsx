'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import Header from '@/components/dashboard/Header'
import RecommendationPanel from '@/components/recommendation/RecommendationPanel'
import WhyPanel from '@/components/recommendation/WhyPanel'
import PriorityRanking from '@/components/priority/PriorityRanking'
import MissionTimeline from '@/components/timeline/MissionTimeline'
import WhatIfPanel from '@/components/whatif/WhatIfPanel'
import AICopilot from '@/components/ai/AICopilot'
import type { RecommendationResponse, WhatIfResponse } from '@/lib/types'

// MapLibre must not run on the server
const SituationMap = dynamic(() => import('@/components/map/SituationMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 text-sm">
      Loading map…
    </div>
  ),
})

// ── Helper: convert WhatIfResponse new_ranking into a RecommendationResponse ──
// so the sidebar panels can be reused unchanged with What-If results.
function whatIfToRecommendation(
  whatIf: WhatIfResponse,
  original: RecommendationResponse,
): RecommendationResponse {
  const topZone = whatIf.new_ranking.find((z) => z.is_recommended) ?? null
  return {
    recommended_target: whatIf.new_recommendation,
    recommended_wildfire_id: whatIf.new_wildfire_id,
    recommendation: topZone
      ? {
          emergency_priority: topZone.emergency_priority,
          satellite_feasibility: topZone.satellite_feasibility,
          final_score: topZone.final_score,
          reasons: topZone.reasons,
        }
      : null,
    ranking: whatIf.new_ranking,
    total_zones: original.total_zones,
    feasible_zones: whatIf.new_ranking.filter((z) => z.feasible).length,
  }
}

export default function Dashboard() {
  const { wildfires, satellites, recommendation: liveRec, status, error, reload } = useDashboard()

  // What-If state — when set, overrides the sidebar display
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResponse | null>(null)
  const [selectedWildfireId, setSelectedWildfireId] = useState<number | null>(null)

  // Active recommendation: What-If result (if any) takes precedence over live data
  const activeRec: RecommendationResponse | null =
    whatIfResult && liveRec
      ? whatIfToRecommendation(whatIfResult, liveRec)
      : liveRec

  const recommendedId = activeRec?.recommended_wildfire_id ?? null
  const unobservableWildfireIds = activeRec?.ranking
    .filter((zone) => !zone.feasible)
    .map((zone) => zone.wildfire_id) ?? []
  const isWhatIfActive = whatIfResult !== null
  const selectedZone = activeRec?.ranking.find(
    (zone) => zone.wildfire_id === (selectedWildfireId ?? recommendedId),
  ) ?? null

  useEffect(() => {
    if (!activeRec) return
    if (!activeRec.ranking.some((zone) => zone.wildfire_id === selectedWildfireId)) {
      setSelectedWildfireId(activeRec.recommended_wildfire_id)
    }
  }, [activeRec, selectedWildfireId])

  function clearWhatIf() {
    setWhatIfResult(null)
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
        <Header wildfires={[]} satellites={[]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading dashboard data…</p>
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
        <Header wildfires={[]} satellites={[]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertTriangle className="w-8 h-8 text-orange-400" />
          <p className="text-slate-200 font-medium">Unable to load dashboard data</p>
          <p className="text-slate-400 text-sm max-w-md">{error}</p>
          <button
            onClick={reload}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Full dashboard ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* ── Header ── */}
      <Header wildfires={wildfires} satellites={satellites} />

      {/* ── What-If active banner ── */}
      {isWhatIfActive && (
        <div className="bg-orange-950/70 border-b border-orange-800 px-6 py-1.5 flex items-center justify-between flex-shrink-0">
          <p className="text-orange-300 text-xs font-medium">
            Showing What-If scenario results — dashboard reflects simulated conditions.
          </p>
          <button
            onClick={clearWhatIf}
            className="text-orange-400 hover:text-orange-200 text-xs underline underline-offset-2 transition-colors"
          >
            Restore live data
          </button>
        </div>
      )}

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left column: Map + Timeline ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Map */}
          <div className="flex-1 min-h-0 border-b border-slate-700">
            <SituationMap
              wildfires={wildfires}
              satellites={satellites}
              recommendedWildfireId={recommendedId}
              selectedWildfireId={selectedZone?.wildfire_id ?? recommendedId}
              unobservableWildfireIds={unobservableWildfireIds}
              onSelectWildfire={setSelectedWildfireId}
            />
          </div>

          {/* Timeline */}
          <div className="flex-shrink-0 h-56 overflow-y-auto p-4 border-b border-slate-700">
            {activeRec ? (
              <MissionTimeline
                ranking={activeRec.ranking}
                satellites={satellites}
                recommendedWildfireId={recommendedId}
              />
            ) : (
              <p className="text-slate-500 text-sm">No timeline data.</p>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-y-auto border-l border-slate-700 bg-slate-950">
          <div className="p-4 space-y-4 flex-1">

            {/* OBSERVE NEXT hero */}
            {activeRec?.recommendation ? (
              <>
                <RecommendationPanel
                  data={activeRec}
                  satellites={satellites}
                  selectedZone={selectedZone}
                  isWhatIf={isWhatIfActive}
                />
                <WhyPanel
                  zoneName={selectedZone?.wildfire_name ?? ''}
                  recommendation={{
                    emergency_priority: selectedZone?.emergency_priority ?? 0,
                    satellite_feasibility: selectedZone?.satellite_feasibility ?? 0,
                    final_score: selectedZone?.final_score ?? 0,
                    reasons: selectedZone?.reasons ?? [],
                  }}
                />
              </>
            ) : (
              <div className="bg-slate-900 border border-slate-700 rounded p-4 text-slate-400 text-sm">
                No observable targets after this scenario.
              </div>
            )}

            {/* Priority ranking */}
            {activeRec && (
              <PriorityRanking
                ranking={activeRec.ranking}
                selectedWildfireId={selectedZone?.wildfire_id ?? recommendedId}
                onSelectWildfire={setSelectedWildfireId}
              />
            )}

            {/* What-If — always uses live ranking for controls, result shown inline */}
            {liveRec && (
              <WhatIfPanel
                ranking={liveRec.ranking}
                onNewRecommendation={setWhatIfResult}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── AI Copilot strip ── */}
      <AICopilot />
    </div>
  )
}
