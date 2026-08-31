'use client'

import { useEffect, useState } from 'react'
import { Satellite as SatIcon, AlertTriangle, Wifi } from 'lucide-react'
import type { Wildfire, Satellite } from '@/lib/types'

interface HeaderProps {
  wildfires: Wildfire[]
  satellites: Satellite[]
}

export default function Header({ wildfires, satellites }: HeaderProps) {
  const [utcTime, setUtcTime] = useState('')

  useEffect(() => {
    function format(d: Date) {
      return d.toUTCString().replace(',', '').replace(' GMT', ' UTC')
    }
    setUtcTime(format(new Date()))
    const interval = setInterval(() => setUtcTime(format(new Date())), 1000)
    return () => clearInterval(interval)
  }, [])

  const activeZones = wildfires.length
  const availableSats = satellites.filter((s) => s.is_available).length
  const totalSats = satellites.length

  return (
    <header
      role="banner"
      className="bg-slate-900 border-b border-slate-700 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0"
    >
      {/* Wordmark */}
      <div className="flex items-center gap-3">
        <SatIcon className="text-blue-400 w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
        <div>
          <span className="text-slate-100 font-bold text-base tracking-tight">
            Orbit911
          </span>
          <span className="text-slate-500 text-xs ml-2 hidden sm:inline">
            Emergency Satellite Operations
          </span>
        </div>
      </div>

      {/* System Status */}
      <div className="flex items-center gap-4 md:gap-6 text-xs">

        {/* Active zones */}
        {activeZones > 0 && (
          <div className="flex items-center gap-1.5" title={`${activeZones} active wildfire zone${activeZones !== 1 ? 's' : ''}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
            <span className="text-slate-300 font-medium tabular-nums">
              {activeZones} Zone{activeZones !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Satellite availability */}
        {totalSats > 0 && (
          <div
            className="hidden sm:flex items-center gap-1.5"
            title={`${availableSats} of ${totalSats} satellites available`}
          >
            <Wifi
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                availableSats > 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
              strokeWidth={2}
            />
            <span className="text-slate-300 font-medium tabular-nums">
              {availableSats}/{totalSats} Sats
            </span>
          </div>
        )}

        {/* UTC clock */}
        <div className="text-slate-500 font-mono hidden md:block tabular-nums" aria-label="Current UTC time">
          {utcTime}
        </div>
      </div>
    </header>
  )
}
