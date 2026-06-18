'use client'

import { useBots } from '@/lib/bots-context'
import { useEffect, useState, useRef, useMemo } from 'react'

// ── Animação de número com easing cúbico ──────────────────────────────────────

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }

function useAnimatedNumber(target: number, duration = 650) {
  const [value, setValue] = useState(target)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<{ from: number; time: number } | null>(null)

  useEffect(() => {
    const from = value
    startRef.current = { from, time: performance.now() }
    const animate = (now: number) => {
      if (!startRef.current) return
      const t = Math.min((now - startRef.current.time) / duration, 1)
      setValue(startRef.current.from + (target - startRef.current.from) * easeOutCubic(t))
      if (t < 1) frameRef.current = requestAnimationFrame(animate)
    }
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(animate)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  return value
}

// ── BalanceCard ───────────────────────────────────────────────────────────────

export function BalanceCard() {
  // Lê dados reais dos bots — profit/wins/losses em tempo real via bots-context
  const { sessionBots, trades } = useBots()

  // Calcular métricas agregadas de todos os bots da sessão
  const { netPnL, totalWins, totalLosses } = useMemo(() => {
    const allBots = sessionBots.filter(b => b.stats.totalTrades > 0 || b.status === 'running')
    return {
      netPnL:      allBots.reduce((s, b) => s + b.stats.netPnL,  0),
      totalWins:   allBots.reduce((s, b) => s + b.stats.wins,    0),
      totalLosses: allBots.reduce((s, b) => s + b.stats.losses,  0),
    }
  }, [sessionBots])

  // Calcular saldo estimado a partir do último trade (profit acumulado)
  // O saldo real vem do trading-context (WebSocket Deriv), mas como o BalanceCard
  // agora foca nos bots, mostramos o PnL líquido da sessão de bots
  const displayProfit  = useAnimatedNumber(netPnL,      700)
  const displayWins    = useAnimatedNumber(totalWins,   300)
  const displayLosses  = useAnimatedNumber(totalLosses, 300)

  const isProfit    = netPnL >= 0
  const totalTrades = totalWins + totalLosses

  return (
    <div
      className="relative rounded-xl overflow-hidden border-2 border-[#2a3142] shadow-lg"
      style={{ background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)' }}
    >
      <div className="flex">
        {/* Trades */}
        <div className="flex-1 p-4 bg-[#0d1117] border-r border-[#2a3142]">
          <div className="mb-2">
            <p className="text-gray-400 text-xs font-medium">Operações</p>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-white text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
              {Math.round(displayWins + displayLosses)}
            </p>
          </div>
          {/* W / L inline com cores */}
          <div className="flex items-center gap-1 mt-2 text-xs font-mono">
            <span className="text-[#22c55e] font-bold">{Math.round(displayWins)}</span>
            <span className="text-gray-600">/</span>
            <span className="text-[#ef4444] font-bold">{Math.round(displayLosses)}</span>
            {totalTrades > 0 && (
              <span className="text-gray-600 text-[10px] ml-1">
                ({((totalWins / totalTrades) * 100).toFixed(0)}% win)
              </span>
            )}
          </div>
        </div>

        {/* Lucro/Prejuízo */}
        <div className="flex-1 p-4 bg-[#1a1f2e] flex flex-col justify-between">
          <p className="text-gray-400 text-xs mb-2 font-medium">Lucro/Prejuízo</p>
          <p
            className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums transition-colors duration-500 ${
              isProfit ? 'text-[#22c55e]' : 'text-[#ef4444]'
            }`}
          >
            <span className="text-base opacity-70">$</span>{' '}
            {/* Prejuízo com sinal de menos, lucro sem sinal */}
            {netPnL < 0 ? '-' : ''}
            {Math.abs(displayProfit).toFixed(2)}
          </p>

          {/* Indicador em tempo real */}
          <div className="flex items-center gap-1.5 mt-2">
            {sessionBots.some(b => b.status === 'running') && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
              </span>
            )}
            <span className="text-gray-600 text-[10px]">
              {trades.length > 0 ? `${trades.length} trade${trades.length !== 1 ? 's' : ''}` : 'Sem trades'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
