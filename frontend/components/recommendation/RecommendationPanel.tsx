'use client'

import { CheckCircle, Satellite } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { RecommendationResponse, Satellite as SatelliteType, ZoneRankingItem } from '@/lib/types'
import { confirmObservation } from '@/lib/api'

interface RecommendationPanelProps {
  data: RecommendationResponse
  satellites: SatelliteType[]
  selectedZone?: ZoneRankingItem | null
  /** True when showing a What-If scenario rather than live data */
  isWhatIf?: boolean
}

export default function RecommendationPanel({ data, satellites, selectedZone, isWhatIf }: RecommendationPanelProps) {
  const displayZone = selectedZone ?? data.ranking.find((zone) => zone.is_recommended) ?? null
  const rec = displayZone
    ? {
        emergency_priority: displayZone.emergency_priority,
        satellite_feasibility: displayZone.satellite_feasibility,
        final_score: displayZone.final_score,
        reasons: displayZone.reasons,
      }
    : data.recommendation
  const isSelectedRecommended = displayZone?.is_recommended ?? false
  const [confirmationStatus, setConfirmationStatus] = useState<'idle' | 'loading' | 'confirmed' | 'error'>('idle')
  const [confirmationError, setConfirmationError] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)

  // Find the best available satellite (highest visibility among available ones)
  const assignedSat = satellites
    .filter((s) => s.is_available && s.observation_window_minutes > 0)
    .sort((a, b) => b.visibility_score - a.visibility_score)[0] ?? null
  const confirmationKey = `${displayZone?.wildfire_id ?? 'none'}:${assignedSat?.id ?? 'none'}`
  const confirmationKeyRef = useRef(confirmationKey)
  const previousConfirmationKeyRef = useRef(confirmationKey)

  // A recalculation with a new target or satellite starts a fresh confirmation
  // state. Responses from an older request are ignored rather than confirming
  // the replacement recommendation.
  useEffect(() => {
    confirmationKeyRef.current = confirmationKey
    if (previousConfirmationKeyRef.current === confirmationKey) return

    previousConfirmationKeyRef.current = confirmationKey
    isSubmittingRef.current = false
    setConfirmationStatus('idle')
    setConfirmationError(null)
  }, [confirmationKey])

  if (!rec || !displayZone) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded p-4 text-slate-400 text-sm">
        No recommendation available.
      </div>
    )
  }

  async function handleConfirmation() {
    const zoneToConfirm = displayZone
    if (
      isWhatIf ||
      !assignedSat ||
      !zoneToConfirm ||
      !zoneToConfirm.wildfire_id ||
      !isSelectedRecommended ||
      isSubmittingRef.current
    ) return

    const requestKey = confirmationKey
    isSubmittingRef.current = true
    setConfirmationStatus('loading')
    setConfirmationError(null)

    try {
      await confirmObservation(zoneToConfirm.wildfire_id, assignedSat.id)
      if (confirmationKeyRef.current !== requestKey) return
      setConfirmationStatus('confirmed')
    } catch {
      if (confirmationKeyRef.current !== requestKey) return
      isSubmittingRef.current = false
      setConfirmationStatus('error')
      setConfirmationError('Unable to confirm the observation. Please try again.')
    }
  }

  const isConfirmed = confirmationStatus === 'confirmed'
  const canConfirm = Boolean(assignedSat) && !isWhatIf && isSelectedRecommended

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
              isConfirmed ? 'bg-emerald-600' : isWhatIf ? 'bg-orange-600' : 'bg-red-600'
            }`}
          >
            {isConfirmed
              ? '✓ Observation Confirmed'
              : isSelectedRecommended
              ? isWhatIf ? '⚡ What-If Result' : '🚨 Observe Next'
              : 'Selected Zone'}
          </span>
        </div>

        {/* Zone name — most prominent text on page */}
        <h2 className="text-slate-100 text-2xl font-bold leading-tight tracking-tight">
          {displayZone.wildfire_name}
        </h2>

        {/* Subtitle context */}
        <p className="text-slate-400 text-xs mt-1">
          {isConfirmed
            ? 'Simulated observation task queued'
            : isSelectedRecommended
            ? 'Highest-priority observable wildfire zone'
            : 'Selected for assessment — recommendation remains highlighted'}
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
        aria-label={`Confirm observation of ${displayZone.wildfire_name}`}
        className={`w-full mt-1 text-sm font-medium py-2 px-4 rounded border transition-colors focus:outline-none focus:ring-2 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70 ${
          isConfirmed
            ? 'bg-emerald-900/60 border-emerald-700 text-emerald-200 focus:ring-emerald-500'
            : 'bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-100 border-slate-600 focus:ring-slate-500'
        }`}
        type="button"
        onClick={handleConfirmation}
        disabled={!canConfirm || confirmationStatus === 'loading' || isConfirmed}
      >
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        {confirmationStatus === 'loading'
          ? 'Confirming Observation…'
          : isConfirmed
          ? 'Observation Confirmed — Queued'
          : isWhatIf
          ? 'Live Recommendation Required'
          : !isSelectedRecommended
          ? 'Recommended Target Required'
          : 'Confirm Observation'}
      </button>
      {isConfirmed && (
        <p className="text-center text-emerald-400 text-xs font-medium">
          Status: QUEUED · {assignedSat?.name}
        </p>
      )}
      {confirmationStatus === 'error' && (
        <p role="alert" className="text-center text-red-400 text-xs">{confirmationError}</p>
      )}
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
