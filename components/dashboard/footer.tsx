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
    <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#0d1117] rounded-xl border-2 border-[#2a3142] shadow-lg">
      <div className="flex items-center gap-2">
        <span 
          className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${
            isConnected ? 'bg-[#22c55e] animate-pulse' : 'bg-[#ef4444]'
          }`} 
        />
        <span className="text-white font-medium text-xs sm:text-sm">{broker}</span>
        <span className={`text-xs ${isConnected ? 'text-gray-500' : 'text-[#ef4444]'}`}>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>
      
      <div className="text-gray-400 text-[10px] sm:text-xs font-mono tracking-tight truncate">
        {currentTime}
      </div>
      
      <button className="text-gray-400 hover:text-white text-xs sm:text-sm underline underline-offset-2 transition-colors shrink-0">
        Planilha
      </button>
    </div>
  )
}
