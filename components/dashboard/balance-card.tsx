'use client'

import { useTrading } from '@/lib/trading-context'
import { useBots } from '@/lib/bots-context'
import { useMemo } from 'react'

// ── BalanceCard ───────────────────────────────────────────────────────────────

export function BalanceCard() {
  // Saldo real em tempo real vem do trading-context (WebSocket Deriv)
  const { balance, currency, loading } = useTrading()

  // PnL, wins e losses em tempo real vêm dos bots reais (bots-context)
  const { sessionBots } = useBots()

  const { netPnL, totalWins, totalLosses } = useMemo(() => {
    const active = sessionBots.filter(b => b.stats.totalTrades > 0 || b.status === 'running')
    return {
      netPnL:      active.reduce((s, b) => s + b.stats.netPnL,  0),
      totalWins:   active.reduce((s, b) => s + b.stats.wins,    0),
      totalLosses: active.reduce((s, b) => s + b.stats.losses,  0),
    }
  }, [sessionBots])

  const isProfit = netPnL >= 0

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-[#2a3142] shadow-lg"
      style={{ background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)' }}
    >
      {/* Loader inicial */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl
          bg-[#0d1117]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-7 h-7">
              <div className="absolute inset-0 rounded-full border-2 border-[#2ec7ff]/15" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent
                border-t-[#2ec7ff] animate-spin" />
            </div>
            <span className="text-gray-500 text-[9px] uppercase tracking-widest">A carregar…</span>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Saldo — vem do WebSocket Deriv em tempo real */}
        <div className="flex-1 p-4 bg-[#0d1117] border-r border-[#2a3142]">
          <div className="mb-2">
            <p className="text-gray-400 text-xs font-medium">Saldo</p>
          </div>
          <p className="text-white text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
            <span className="text-gray-500 text-base">$</span>{' '}
            {balance.toFixed(2)}{' '}
            <span className="text-sm font-normal text-gray-500">{currency}</span>
          </p>
        </div>

        {/* Lucro/Prejuízo — vem dos bots reais em tempo real */}
        <div className="flex-1 p-4 bg-[#1a1f2e] flex flex-col justify-between">
          <p className="text-gray-400 text-xs mb-2 font-medium">Lucro/Prejuízo</p>
          <p className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${isProfit ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            <span className="text-base opacity-70">$</span>{' '}
            {/* Prejuízo com sinal menos, lucro sem sinal */}
            {netPnL < 0 ? '-' : ''}
            {Math.abs(netPnL).toFixed(2)}
          </p>

          {/* W / L em tempo real */}
          <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
            <span>Operações</span>
            <span className="text-[#22c55e] font-bold">{totalWins}</span>
            <span>/</span>
            <span className="text-[#ef4444] font-bold">{totalLosses}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
