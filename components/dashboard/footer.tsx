'use client'

import { useEffect, useState } from 'react'
import { useTrading } from '@/lib/trading-context'

export function Footer() {
  const { isConnected } = useTrading()
  const [currentTime, setCurrentTime] = useState('')
  const broker = 'Deriv'

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const year = now.getUTCFullYear()
      const month = String(now.getUTCMonth() + 1).padStart(2, '0')
      const day = String(now.getUTCDate()).padStart(2, '0')
      const hours = String(now.getUTCHours()).padStart(2, '0')
      const minutes = String(now.getUTCMinutes()).padStart(2, '0')
      const seconds = String(now.getUTCSeconds()).padStart(2, '0')
      const formatted = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} GMT`
      setCurrentTime(formatted)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#0d1117] rounded-xl border border-[#2a3142]">
      {/* Status de conexão */}
      <div className="flex items-center gap-2">
        <span 
          className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ${
            isConnected 
              ? 'bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
              : 'bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.6)]'
          }`} 
        />
        <span className="text-white font-semibold text-sm">{broker}</span>
      </div>
      
      {/* Timestamp */}
      <div className="text-gray-400 text-xs font-mono tracking-tight">
        {currentTime}
      </div>
      
      {/* Link para planilha */}
      <button className="text-gray-400 hover:text-[#2ec7ff] text-sm font-medium transition-colors">
        Planilha
      </button>
    </div>
  )
}
