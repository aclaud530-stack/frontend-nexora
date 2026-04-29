'use client'
import { useTrading } from '@/lib/trading-context'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState, useRef } from 'react'
import { Account } from '@/lib/api'

// ─── Ícones ───────────────────────────────────────────────────────────────────

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconRefresh({ spinning }: { spinning: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M9.5 5.5A4 4 0 1 1 5.5 1.5a4 4 0 0 1 2.83 1.17L9.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8 4h1.5V2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Linha de conta no dropdown ───────────────────────────────────────────────

function AccountRow({
  account,
  isActive,
  onClick,
}: {
  account: Account
  isActive: boolean
  onClick: () => void
}) {
  const isDemo = account.account_type === 'demo'

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
        transition-all duration-150
        ${isActive
          ? 'bg-[#0d1117] border border-[#2ec7ff]/25'
          : 'hover:bg-[#0d1117]/60 border border-transparent'
        }
      `}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDemo ? 'bg-[#2ec7ff]' : 'bg-[#22c55e]'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-[11px] font-semibold truncate">{account.account_id}</span>
          <span className={`
            text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded
            ${isDemo ? 'bg-[#2ec7ff]/10 text-[#2ec7ff]' : 'bg-[#22c55e]/10 text-[#22c55e]'}
          `}>
            {isDemo ? 'Demo' : 'Real'}
          </span>
        </div>
        <div className="text-gray-600 text-[9px]">{account.currency}</div>
      </div>

      <div className="text-white text-[11px] font-bold shrink-0">
        ${Number(account.balance ?? 0).toFixed(2)}
      </div>

      {isActive && (
        <div className="w-1 h-1 rounded-full bg-[#2ec7ff] shrink-0" />
      )}
    </button>
  )
}

// ─── Botão de troca de conta ──────────────────────────────────────────────────

function AccountSwitcherButton() {
  const { accounts, currentAccount, setCurrentAccount, refreshAccounts } = useAuth()
  const [open, setOpen]           = useState(false)
  const [switching, setSwitching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const handleSwitch = async (account: Account) => {
    if (account.account_id === currentAccount?.account_id) { setOpen(false); return }
    setSwitching(true)
    try {
      await setCurrentAccount(account)
    } finally {
      setSwitching(false)
      setOpen(false)
    }
  }

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setRefreshing(true)
    try { await refreshAccounts() } finally { setRefreshing(false) }
  }

  const isDemo        = currentAccount?.account_type === 'demo'
  const demoAccounts  = accounts.filter(a => a.account_type === 'demo')
  const realAccounts  = accounts.filter(a => a.account_type === 'real')

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        disabled={switching}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold
          transition-all duration-150 select-none
          ${switching ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
          ${open
            ? 'bg-[#0d1117] border-[#2ec7ff]/40 text-[#2ec7ff]'
            : isDemo
              ? 'bg-[#2ec7ff]/5 border-[#2ec7ff]/20 text-[#2ec7ff] hover:border-[#2ec7ff]/40'
              : 'bg-[#22c55e]/5 border-[#22c55e]/20 text-[#22c55e] hover:border-[#22c55e]/40'
          }
        `}
      >
        {switching ? (
          <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className={`w-1.5 h-1.5 rounded-full ${isDemo ? 'bg-[#2ec7ff]' : 'bg-[#22c55e]'}`} />
        )}
        <span className="uppercase tracking-wider text-[9px]">
          {currentAccount ? (isDemo ? 'Demo' : 'Real') : '—'}
        </span>
        <span className="text-gray-400 text-[10px] font-medium hidden sm:inline">
          {currentAccount?.account_id ?? ''}
        </span>
        <span className="opacity-60">
          <IconChevron open={open} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="
          absolute left-0 top-full mt-1.5 z-50
          w-56 rounded-xl border border-[#2a3142] shadow-2xl
          bg-[#1a1f2e] overflow-hidden
        ">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a3142]">
            <span className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">
              Mudar conta
            </span>
            <button
              onClick={handleRefresh}
              className="text-gray-500 hover:text-[#2ec7ff] transition-colors p-1 rounded"
            >
              <IconRefresh spinning={refreshing} />
            </button>
          </div>

          <div className="p-1.5 max-h-64 overflow-y-auto">
            {accounts.length === 0 ? (
              <p className="text-gray-600 text-[10px] text-center py-4">
                Nenhuma conta encontrada
              </p>
            ) : (
              <>
                {demoAccounts.length > 0 && (
                  <div className="mb-1">
                    <p className="text-gray-600 text-[8px] uppercase tracking-widest px-2 py-1">Demo</p>
                    {demoAccounts.map(acc => (
                      <AccountRow
                        key={acc.account_id}
                        account={acc}
                        isActive={currentAccount?.account_id === acc.account_id}
                        onClick={() => handleSwitch(acc)}
                      />
                    ))}
                  </div>
                )}
                {realAccounts.length > 0 && (
                  <div>
                    <p className="text-gray-600 text-[8px] uppercase tracking-widest px-2 py-1">Real</p>
                    {realAccounts.map(acc => (
                      <AccountRow
                        key={acc.account_id}
                        account={acc}
                        isActive={currentAccount?.account_id === acc.account_id}
                        onClick={() => handleSwitch(acc)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {currentAccount && (
            <div className="px-3 py-1.5 border-t border-[#2a3142] bg-[#0d1117]/40 flex items-center justify-between">
              <span className="text-gray-600 text-[9px]">Ativa</span>
              <span className="text-gray-400 text-[9px] font-semibold">{currentAccount.account_id}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── BalanceCard ──────────────────────────────────────────────────────────────

export function BalanceCard() {
  const { balance, profit, wins, losses, currency } = useTrading()
  const [displayBalance, setDisplayBalance] = useState(balance)
  const [displayProfit,  setDisplayProfit]  = useState(profit)

  useEffect(() => {
    const animateValue = (start: number, end: number, setter: (v: number) => void) => {
      const duration  = 500
      const startTime = Date.now()
      const animate   = () => {
        const progress = Math.min((Date.now() - startTime) / duration, 1)
        const ease     = (t: number) => t * (2 - t)
        setter(start + (end - start) * ease(progress))
        if (progress < 1) requestAnimationFrame(animate)
      }
      animate()
    }
    animateValue(displayBalance, balance, setDisplayBalance)
    animateValue(displayProfit,  profit,  setDisplayProfit)
  }, [balance, profit]) // eslint-disable-line react-hooks/exhaustive-deps

  const isProfit = profit >= 0

  return (
    <div
      className="rounded-xl overflow-hidden border-2 border-[#2a3142] shadow-lg"
      style={{ background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)' }}
    >
      <div className="flex">
        {/* Saldo */}
        <div className="flex-1 p-3 sm:p-4 bg-[#0d1117]/90 border-r border-[#2a3142]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-gray-400 text-xs sm:text-sm font-medium">Saldo</p>
            {/* Botão de troca de conta */}
            <AccountSwitcherButton />
          </div>
          <p className="text-white text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
            <span className="text-gray-400">$</span>{' '}
            {displayBalance.toFixed(2)}{' '}
            <span className="text-xs sm:text-sm font-normal text-gray-400">{currency}</span>
          </p>
        </div>

        {/* Lucro/Prejuízo */}
        <div className="flex-1 p-3 sm:p-4 bg-[#1a1f2e]">
          <p className="text-gray-400 text-xs sm:text-sm mb-0.5 font-medium">Lucro/Prejuízo</p>
          <p className={`
            text-lg sm:text-xl md:text-2xl font-bold tracking-tight
            transition-colors duration-300
            ${isProfit ? 'text-[#22c55e]' : 'text-[#ef4444]'}
          `}>
            <span className="text-gray-500">{isProfit ? '+' : '-'}$</span>{' '}
            {Math.abs(displayProfit).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Operações */}
      <div className="px-3 sm:px-4 py-2 text-right bg-[#0d1117]/50 border-t border-[#2a3142]">
        <span className="text-gray-400 text-xs sm:text-sm font-medium">
          Operações{' '}
          <span className="text-[#22c55e] font-bold">{wins}</span>{' '}
          <span className="text-gray-600">/</span>{' '}
          <span className="text-white">{losses}</span>
        </span>
      </div>
    </div>
  )
}
