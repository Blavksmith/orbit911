'use client'

import dynamic from 'next/dynamic'
import { MOCK_RECOMMENDATION, MOCK_WILDFIRES, MOCK_SATELLITES } from '@/data/mock'
import Header from '@/components/dashboard/Header'
import RecommendationPanel from '@/components/recommendation/RecommendationPanel'
import WhyPanel from '@/components/recommendation/WhyPanel'
import PriorityRanking from '@/components/priority/PriorityRanking'
import MissionTimeline from '@/components/timeline/MissionTimeline'
import WhatIfPanel from '@/components/whatif/WhatIfPanel'
import AICopilot from '@/components/ai/AICopilot'

// MapLibre must not run on the server
const SituationMap = dynamic(() => import('@/components/map/SituationMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 text-sm">
      Loading map…
    </div>
  ),
})

export default function Dashboard() {
  const rec = MOCK_RECOMMENDATION
  const recommendedId = rec.recommended_wildfire_id

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* ── Header ── */}
      <Header />

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left column: Map + Timeline ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Map — takes available space */}
          <div className="flex-1 min-h-0 border-b border-slate-700">
            <SituationMap
              wildfires={MOCK_WILDFIRES}
              satellites={MOCK_SATELLITES}
              recommendedWildfireId={recommendedId}
            />
          </div>

          {/* Timeline — fixed height */}
          <div className="flex-shrink-0 h-56 overflow-y-auto p-4 border-b border-slate-700">
            <MissionTimeline
              ranking={rec.ranking}
              recommendedWildfireId={recommendedId}
            />
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-y-auto border-l border-slate-700 bg-slate-950">
          <div className="p-4 space-y-4 flex-1">
            {/* OBSERVE NEXT hero */}
            {rec.recommendation && (
              <>
                <RecommendationPanel data={rec} />
                <WhyPanel
                  zoneName={rec.recommended_target ?? ''}
                  recommendation={rec.recommendation}
                />
              </>
            )}

            {/* Priority ranking */}
            <PriorityRanking ranking={rec.ranking} />

            {/* What-If */}
            <WhatIfPanel ranking={rec.ranking} />
          </div>
        </div>
      </div>

      {/* ── AI Copilot strip ── */}
      <AICopilot />
    </div>
  )
}
