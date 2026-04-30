'use client'

import { useTrading } from '@/lib/trading-context'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Account } from '@/lib/api'

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

// ── Ícones ────────────────────────────────────────────────────────────────────

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconRefresh({ spinning }: { spinning: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M9.5 5.5A4 4 0 1 1 5.5 1.5a4 4 0 0 1 2.83 1.17L9.5 4"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8 4h1.5V2.5" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconSwitch() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M1 3.5h10M8 1.5l2.5 2L8 5.5" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 8.5H1M4 6.5 1.5 8.5 4 10.5" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
// ── BalanceCard ───────────────────────────────────────────────────────────────

export function BalanceCard() {
  const { balance, profit, wins, losses, currency, loading } = useTrading()
  const [isSwitching, setIsSwitching] = useState(false)

  const displayBalance = useAnimatedNumber(balance, 700)
  const displayProfit  = useAnimatedNumber(profit,  700)

  const isProfit = profit >= 0
  const total    = wins + losses
  const winRate  = total > 0 ? Math.round((wins / total) * 100) : null

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-[#2a3142] shadow-lg"
      style={{ background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)' }}
    >
      {/* Loader inicial — primeiro tick ainda não chegou */}
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

      {/* Overlay de troca de conta */}
      {isSwitching && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl
          bg-[#0d1117]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-[#2ec7ff]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent
                border-t-[#2ec7ff] animate-spin" />
            </div>
            <span className="text-[#2ec7ff] text-[9px] font-bold uppercase tracking-widest">
              A trocar…
            </span>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Saldo */}
        <div className="flex-1 p-4 bg-[#0d1117] border-r border-[#2a3142]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-medium">Saldo</p>
            <AccountSwitcherButton onSwitching={setIsSwitching} />
          </div>
          <p className="text-white text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
            <span className="text-gray-500 text-base">$</span>{' '}
            {displayBalance.toFixed(2)}{' '}
            <span className="text-sm font-normal text-gray-500">{currency}</span>
          </p>
        </div>

        {/* Lucro/Prejuízo */}
        <div className="flex-1 p-4 bg-[#1a1f2e] flex flex-col justify-between">
          <p className="text-gray-400 text-xs mb-2 font-medium">Lucro/Prejuízo</p>
          <p className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums transition-colors duration-500 ${isProfit ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            <span className="text-base opacity-70">$</span>{' '}
            {displayProfit.toFixed(2)}
          </p>
          
          {/* Operações inline */}
          <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
            <span>Operações</span>
            <span className="text-[#22c55e] font-bold">{wins}</span>
            <span>/</span>
            <span className="text-[#ef4444] font-bold">{losses}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
