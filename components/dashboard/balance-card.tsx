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

// ── Linha de conta ────────────────────────────────────────────────────────────

function AccountRow({ account, isActive, onClick }: {
  account: Account; isActive: boolean; onClick: () => void
}) {
  const isDemo = account.account_type === 'demo'
  const label  = isDemo ? 'Conta Demo' : 'Conta Real'
  const color  = isDemo ? '#2ec7ff' : '#22c55e'
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
        transition-all duration-150
        ${isActive ? 'bg-[#0d1117] border border-[#2ec7ff]/30'
                   : 'hover:bg-[#0d1117]/60 border border-transparent'}`}
    >
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white text-[11px] font-semibold truncate">{account.account_id}</span>
          <span className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded"
            style={{ background: `${color}18`, color }}>{label}</span>
        </div>
        <div className="text-gray-600 text-[9px] mt-0.5">{account.currency}</div>
      </div>
      <div className="text-white text-[11px] font-bold shrink-0 tabular-nums">
        ${Number(account.balance ?? 0).toFixed(2)}
      </div>
      {isActive && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
    </button>
  )
}

// ── Botão de troca ────────────────────────────────────────────────────────────

function AccountSwitcherButton({ onSwitching }: { onSwitching: (v: boolean) => void }) {
  const { accounts, currentAccount, setCurrentAccount, refreshAccounts } = useAuth()
  const [open,       setOpen]       = useState(false)
  const [switching,  setSwitching]  = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const handleSwitch = useCallback(async (account: Account) => {
    if (account.account_id === currentAccount?.account_id) { setOpen(false); return }
    setSwitching(true); onSwitching(true)
    try { await setCurrentAccount(account) }
    finally { setSwitching(false); onSwitching(false); setOpen(false) }
  }, [currentAccount, setCurrentAccount, onSwitching])

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setRefreshing(true)
    try { await refreshAccounts() } finally { setRefreshing(false) }
  }

  const demo = accounts.filter(a => a.account_type === 'demo')
  const real = accounts.filter(a => a.account_type === 'real')

  return (
    <div ref={ref} className="relative">
      <button onClick={() => !switching && setOpen(v => !v)} disabled={switching}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border
          text-[9px] font-bold uppercase tracking-wider transition-all duration-150 select-none
          ${switching ? 'opacity-50 cursor-wait border-[#2a3142] text-gray-500'
            : open ? 'bg-[#0d1117] border-[#2ec7ff]/40 text-[#2ec7ff]'
            : 'bg-[#2ec7ff]/5 border-[#2ec7ff]/20 text-[#2ec7ff] hover:border-[#2ec7ff]/40 hover:bg-[#2ec7ff]/10'}`}
      >
        {switching
          ? <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          : <IconSwitch />}
        <span>Mudar conta</span>
        <span className="opacity-60"><IconChevron open={open} /></span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-60 rounded-xl
          border border-[#2a3142] shadow-2xl bg-[#1a1f2e] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a3142]">
            <span className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">
              Selecionar conta
            </span>
            <button onClick={handleRefresh}
              className="text-gray-500 hover:text-[#2ec7ff] transition-colors p-1 rounded">
              <IconRefresh spinning={refreshing} />
            </button>
          </div>

          <div className="p-1.5 max-h-64 overflow-y-auto">
            {accounts.length === 0 ? (
              <p className="text-gray-600 text-[10px] text-center py-4">Nenhuma conta encontrada</p>
            ) : (
              <>
                {demo.length > 0 && (
                  <div className="mb-1">
                    <p className="text-gray-600 text-[8px] uppercase tracking-widest px-2 py-1">Demo</p>
                    {demo.map(a => <AccountRow key={a.account_id} account={a}
                      isActive={currentAccount?.account_id === a.account_id}
                      onClick={() => handleSwitch(a)} />)}
                  </div>
                )}
                {real.length > 0 && (
                  <div>
                    <p className="text-gray-600 text-[8px] uppercase tracking-widest px-2 py-1">Real</p>
                    {real.map(a => <AccountRow key={a.account_id} account={a}
                      isActive={currentAccount?.account_id === a.account_id}
                      onClick={() => handleSwitch(a)} />)}
                  </div>
                )}
              </>
            )}
          </div>

          {currentAccount && (
            <div className="px-3 py-1.5 border-t border-[#2a3142] bg-[#0d1117]/40
              flex items-center justify-between">
              <span className="text-gray-600 text-[9px]">Conta ativa</span>
              <span className="text-gray-400 text-[9px] font-semibold tabular-nums">
                {currentAccount.account_id}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
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
