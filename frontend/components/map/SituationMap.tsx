'use client'

import { useRef, useEffect } from 'react'
import { Map, Marker, Popup, NavigationControl, AttributionControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Wildfire, Satellite } from '@/lib/types'

// ── Fix 1: Worker URL ─────────────────────────────────────────────────────────
// MapLibre GL v6 uses import.meta.url to locate its worker script. When
// webpack/Next.js bundles the file that URL becomes a virtual module path that
// cannot be fetched. We point maplibre at the worker we copied to /public so
// the browser can actually load it.
setWorkerUrl('/maplibre-gl-worker.mjs')

// ── Fix 2: Basemap style ──────────────────────────────────────────────────────
// demotiles.maplibre.org was decommissioned. We replace it with a public
// OpenFreeMap "Positron" style (no API key required, open license).
// Fallback option also noted in comments below.
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SituationMapProps {
  wildfires: Wildfire[]
  satellites: Satellite[]
  recommendedWildfireId: number | null
  unobservableWildfireIds: number[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityColor(severity: number): string {
  if (severity >= 75) return '#f87171' // red-400
  if (severity >= 50) return '#fb923c' // orange-400
  if (severity >= 25) return '#facc15' // yellow-400
  return '#4ade80'                     // green-400
}

function severityRadius(severity: number): number {
  return 10 + (severity / 100) * 18
}

// Inject the pulse keyframe animation once into <head>
function ensurePulseStyle() {
  if (document.getElementById('orbit911-pulse-style')) return
  const style = document.createElement('style')
  style.id = 'orbit911-pulse-style'
  style.textContent = `
    @keyframes orbit911-pulse {
      0%   { transform: scale(0.7); opacity: 0.7; }
      100% { transform: scale(1.3); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SituationMap({
  wildfires,
  satellites,
  recommendedWildfireId,
  unobservableWildfireIds,
}: SituationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  // Keep marker refs so we can clean them up when data changes
  const markersRef = useRef<Marker[]>([])

  // ── Initialise the map once ────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return

    const map = new Map({
      container: mapContainer.current,
      style: BASEMAP_STYLE,
      center: [-118.0, 35.3],
      zoom: 8,
      attributionControl: false,
    })

    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new NavigationControl({ showCompass: false }), 'top-left')

    mapRef.current = map

    return () => {
      // Clean up on unmount
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
    // Run once — markers are added in a separate effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Add / refresh markers whenever data or recommendation changes ──────────
  // Fix 3: The original effect had [] as its deps so it captured the initial
  // empty arrays and never re-ran once the API data arrived.  We now separate
  // map initialisation (runs once) from marker placement (runs whenever the
  // prop data changes).
  useEffect(() => {
    if (!mapRef.current) return
    const mapInstance = mapRef.current

    // Helper: add markers once the map style is ready
    function addMarkers() {
      ensurePulseStyle()

      // Remove previous markers before re-adding
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      // ── Wildfire markers ────────────────────────────────────────────────
      wildfires.forEach((wf) => {
        const isRecommended = wf.id === recommendedWildfireId
        const isInfeasible = unobservableWildfireIds.includes(wf.id)
        const color = isInfeasible
          ? '#64748b'
          : isRecommended
          ? '#f87171'
          : severityColor(wf.severity)
        const radius = severityRadius(wf.severity)

        // Animated pulse ring for the recommended zone
        if (isRecommended) {
          const pulseEl = document.createElement('div')
          const pulseSize = radius * 3.5
          pulseEl.style.cssText = `
            width: ${pulseSize}px;
            height: ${pulseSize}px;
            border: 2.5px solid #f87171;
            border-radius: 50%;
            opacity: 0;
            pointer-events: none;
            animation: orbit911-pulse 2s ease-out infinite;
          `
          new Marker({ element: pulseEl, anchor: 'center' })
            .setLngLat([wf.longitude, wf.latitude])
            .addTo(mapInstance)
          // No push — pulse markers are decorative and cleaned up with map.remove()
        }

        // Main circle marker
        const el = document.createElement('div')
        el.style.cssText = `
          width: ${radius * 2}px;
          height: ${radius * 2}px;
          background-color: ${color};
          border-radius: 50%;
          border: ${isRecommended ? '3px solid #fff' : '1.5px solid rgba(255,255,255,0.25)'};
          opacity: ${isInfeasible ? 0.35 : 0.88};
          cursor: pointer;
          box-shadow: ${isRecommended ? '0 0 12px rgba(248,113,113,0.6)' : 'none'};
        `

        const popup = new Popup({ offset: radius + 4, closeButton: false })
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:6px 8px;min-width:160px">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${wf.name}</div>
              <div style="font-size:11px;color:#6b7280">Severity: ${wf.severity}/100</div>
              <div style="font-size:11px;color:#6b7280">Growth rate: ${wf.fire_growth_rate}/100</div>
              <div style="font-size:11px;color:#6b7280">Population: ${wf.population_exposed.toLocaleString()}</div>
              ${isRecommended ? '<div style="font-size:11px;font-weight:700;color:#ef4444;margin-top:4px">🚨 RECOMMENDED TARGET</div>' : ''}
              ${isInfeasible ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px">○ Not observable</div>' : ''}
            </div>
          `)

        const marker = new Marker({ element: el, anchor: 'center' })
          .setLngLat([wf.longitude, wf.latitude])
          .setPopup(popup)
          .addTo(mapInstance)

        markersRef.current.push(marker)
      })

      // ── Satellite markers ───────────────────────────────────────────────
      satellites.forEach((sat) => {
        const el = document.createElement('div')
        el.innerHTML = '✦'
        el.style.cssText = `
          color: ${sat.is_available ? '#60a5fa' : '#475569'};
          font-size: 16px;
          cursor: pointer;
          text-shadow: 0 0 4px rgba(0,0,0,0.9);
          opacity: ${sat.is_available ? 1 : 0.5};
          line-height: 1;
        `

        const popup = new Popup({ offset: 12, closeButton: false })
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:6px 8px;min-width:140px">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${sat.name}</div>
              <div style="font-size:11px;color:#6b7280">Visibility: ${sat.visibility_score}%</div>
              <div style="font-size:11px;color:#6b7280">Window: ${sat.observation_window_minutes} min</div>
              <div style="font-size:11px;color:#6b7280">Battery: ${sat.battery_level}%</div>
              <div style="font-size:11px;font-weight:600;color:${sat.is_available ? '#22c55e' : '#ef4444'};margin-top:4px">
                ${sat.is_available ? '● Available' : '○ Unavailable'}
              </div>
            </div>
          `)

        const marker = new Marker({ element: el, anchor: 'center' })
          .setLngLat([sat.longitude, sat.latitude])
          .setPopup(popup)
          .addTo(mapInstance)

        markersRef.current.push(marker)
      })
    }

    // If the style is already loaded, add markers immediately.
    // Otherwise wait for the 'load' event (first render after map init).
    if (mapInstance.isStyleLoaded()) {
      addMarkers()
    } else {
      mapInstance.once('load', addMarkers)
    }

    // Cleanup: if this effect re-runs before 'load' fires, remove the listener
    return () => {
      mapInstance.off('load', addMarkers)
    }
  }, [wildfires, satellites, recommendedWildfireId, unobservableWildfireIds])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-8 left-3 bg-slate-950/90 border border-slate-700 rounded px-3 py-2 text-xs text-slate-300 space-y-1.5 backdrop-blur-sm">
        <div className="text-slate-400 font-semibold text-[10px] uppercase tracking-wide mb-1.5">
          Legend
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400 ring-1 ring-white/30" />
          High severity
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-orange-400 ring-1 ring-white/30" />
          Medium severity
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 ring-1 ring-white/30" />
          Low severity
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-slate-600 opacity-50" />
          Not observable
        </div>
        <div className="flex items-center gap-2 border-t border-slate-700 pt-1.5 mt-1">
          <span className="text-blue-400 text-sm leading-none">✦</span>
          Satellite
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400 ring-2 ring-red-400/60" />
          Recommended
        </div>
      </div>
    </div>
  )
}
