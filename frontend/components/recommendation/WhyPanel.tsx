'use client'

import { Flame, Users, Building2, Activity, Clock } from 'lucide-react'
import type { RecommendationDetail } from '@/lib/types'

interface WhyPanelProps {
  zoneName: string
  recommendation: RecommendationDetail
}

const REASON_ICONS: Record<string, React.ReactNode> = {
  fire: <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />,
  people: <Users className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />,
  hospital: <Building2 className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />,
  infra: <Building2 className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />,
  severity: <Activity className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />,
  time: <Clock className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
  default: <span className="w-3.5 h-3.5 flex-shrink-0 text-slate-500">·</span>,
}

function getIcon(reason: string): React.ReactNode {
  const r = reason.toLowerCase()
  if (r.includes('fire') || r.includes('growth')) return REASON_ICONS.fire
  if (r.includes('population') || r.includes('people')) return REASON_ICONS.people
  if (r.includes('hospital')) return REASON_ICONS.hospital
  if (r.includes('infrastructure')) return REASON_ICONS.infra
  if (r.includes('severity')) return REASON_ICONS.severity
  if (r.includes('window') || r.includes('time') || r.includes('recent')) return REASON_ICONS.time
  return REASON_ICONS.default
}

export default function WhyPanel({ zoneName, recommendation }: WhyPanelProps) {
  // Show only the top 5 reasons
  const displayReasons = recommendation.reasons.slice(0, 5)
  const shortName = zoneName.split(' — ')[0] ?? zoneName

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
      <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
        Why {shortName}?
      </h3>
      <ul className="space-y-2">
        {displayReasons.map((reason, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
            {getIcon(reason)}
            <span>{reason}</span>
          </li>
        ))}
      </ul>
      {recommendation.reasons.length > 5 && (
        <p className="text-slate-500 text-xs">
          +{recommendation.reasons.length - 5} more factors
        </p>
      )}
    </div>
  )
}
