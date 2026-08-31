'use client'

import { useRef, useEffect } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Wildfire, Satellite } from '@/lib/types'

interface SituationMapProps {
  wildfires: Wildfire[]
  satellites: Satellite[]
  recommendedWildfireId: number | null
}

function severityColor(severity: number): string {
  if (severity >= 75) return '#f87171' // red-400
  if (severity >= 50) return '#fb923c' // orange-400
  if (severity >= 25) return '#facc15' // yellow-400
  return '#4ade80'                     // green-400
}

function severityRadius(severity: number): number {
  return 10 + (severity / 100) * 18
}

export default function SituationMap({ wildfires, satellites, recommendedWildfireId }: SituationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-118.0, 35.3],
      zoom: 8,
      attributionControl: false,
    })

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

    mapRef.current = map

    map.on('load', () => {
      // Add wildfire markers
      wildfires.forEach((wf) => {
        const isRecommended = wf.id === recommendedWildfireId
        const color = isRecommended
          ? '#f87171'
          : wf.id === 4
          ? '#64748b' // muted for infeasible
          : severityColor(wf.severity)
        const radius = severityRadius(wf.severity)

        // Outer pulse ring for recommended zone
        if (isRecommended) {
          const pulseEl = document.createElement('div')
          pulseEl.style.cssText = `
            width: ${radius * 3}px;
            height: ${radius * 3}px;
            border: 2px solid #f87171;
            border-radius: 50%;
            opacity: 0.5;
            pointer-events: none;
          `
          new maplibregl.Marker({ element: pulseEl, anchor: 'center' })
            .setLngLat([wf.longitude, wf.latitude])
            .addTo(map)
          markersRef.current.push()
        }

        // Main circle marker
        const el = document.createElement('div')
        el.style.cssText = `
          width: ${radius * 2}px;
          height: ${radius * 2}px;
          background-color: ${color};
          border-radius: 50%;
          border: ${isRecommended ? '3px solid #fff' : '1.5px solid rgba(255,255,255,0.25)'};
          opacity: ${wf.id === 4 ? 0.45 : 0.85};
          cursor: pointer;
        `

        const popup = new maplibregl.Popup({ offset: radius + 4, closeButton: false })
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:6px 8px;min-width:160px">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${wf.name}</div>
              <div style="font-size:11px;color:#6b7280">Severity: ${wf.severity}/100</div>
              <div style="font-size:11px;color:#6b7280">Growth rate: ${wf.fire_growth_rate}/100</div>
              <div style="font-size:11px;color:#6b7280">Population: ${wf.population_exposed.toLocaleString()}</div>
              ${isRecommended ? '<div style="font-size:11px;font-weight:600;color:#ef4444;margin-top:4px">⬤ RECOMMENDED TARGET</div>' : ''}
            </div>
          `)

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([wf.longitude, wf.latitude])
          .setPopup(popup)
          .addTo(map)

        markersRef.current.push(marker)
      })

      // Add satellite markers
      satellites.forEach((sat) => {
        const el = document.createElement('div')
        el.innerHTML = '✦'
        el.style.cssText = `
          color: ${sat.is_available ? '#60a5fa' : '#475569'};
          font-size: 16px;
          cursor: pointer;
          text-shadow: 0 0 3px rgba(0,0,0,0.8);
        `

        const popup = new maplibregl.Popup({ offset: 12, closeButton: false })
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:6px 8px;min-width:140px">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${sat.name}</div>
              <div style="font-size:11px;color:#6b7280">Visibility: ${sat.visibility_score}%</div>
              <div style="font-size:11px;color:#6b7280">Battery: ${sat.battery_level}%</div>
              <div style="font-size:11px;font-weight:600;color:${sat.is_available ? '#22c55e' : '#ef4444'};margin-top:4px">
                ${sat.is_available ? '● Available' : '○ Unavailable'}
              </div>
            </div>
          `)

        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([sat.longitude, sat.latitude])
          .setPopup(popup)
          .addTo(map)
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-8 left-3 bg-slate-900/90 border border-slate-700 rounded px-3 py-2 text-xs text-slate-300 space-y-1.5">
        <div className="text-slate-400 font-medium mb-1">Legend</div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
          High severity
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-orange-400" />
          Medium severity
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" />
          Low severity
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-slate-500 opacity-50" />
          Not observable
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-sm">✦</span>
          Satellite
        </div>
      </div>
    </div>
  )
}
