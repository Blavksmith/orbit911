'use client'

import { useEffect, useState } from 'react'
import { Satellite, AlertTriangle } from 'lucide-react'

export default function Header() {
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

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
      {/* Wordmark */}
      <div className="flex items-center gap-3">
        <Satellite className="text-blue-400 w-5 h-5" strokeWidth={1.5} />
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
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-slate-300 font-medium">4 Active Zones</span>
        </div>
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-300 font-medium">2 Satellites Available</span>
        </div>
        <div className="text-slate-500 font-mono hidden md:block">
          {utcTime}
        </div>
      </div>
    </header>
  )
}
