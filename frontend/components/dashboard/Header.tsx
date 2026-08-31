'use client'

import { useEffect, useState } from 'react'
import { Satellite as SatIcon, AlertTriangle } from 'lucide-react'
import type { Wildfire, Satellite } from '@/lib/types'

interface HeaderProps {
  wildfires: Wildfire[]
  satellites: Satellite[]
}

export default function Header({ wildfires, satellites }: HeaderProps) {
  const [utcTime, setUtcTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setUtcTime(
        now.toUTCString().replace('GMT', 'UTC').split(' ').slice(1).join(' ')
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  const activeZones = wildfires.length
  const availableSats = satellites.filter((s) => s.is_available).length

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
      {/* Wordmark */}
      <div className="flex items-center gap-3">
        <SatIcon className="text-blue-400 w-5 h-5" strokeWidth={1.5} />
        <div>
          <span className="text-slate-100 font-semibold text-base tracking-tight">
            Orbit911
          </span>
          <span className="text-slate-500 text-xs ml-2 hidden sm:inline">
            Emergency Satellite Operations
          </span>
        </div>
      </div>

      {/* System Status */}
      <div className="flex items-center gap-6 text-xs">
        {activeZones > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-slate-300 font-medium">
              {activeZones} Active Zone{activeZones !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {satellites.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                availableSats > 0 ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            <span className="text-slate-300 font-medium">
              {availableSats} Satellite{availableSats !== 1 ? 's' : ''} Available
            </span>
          </div>
        )}
        <div className="text-slate-500 font-mono hidden md:block">
          {utcTime}
        </div>
      </div>
    </header>
  )
}
