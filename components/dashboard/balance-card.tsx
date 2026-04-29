'use client'
import { useTrading } from '@/lib/trading-context'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState, useRef } from 'react'
import { Account } from '@/lib/api'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { AccountSwitchLoader } from '@/components/ui/dashboard-loader'

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
        w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left
        transition-all duration-150
        ${isActive
          ? 'bg-[#0d1117] border border-[#2ec7ff]/25'
          : 'hover:bg-[#0d1117]/60 border border-transparent'
        }
      `}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${isDemo ? 'bg-[#2ec7ff]' : 'bg-[#22c55e]'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold">
            {isDemo ? 'Conta Demo' : 'Conta Real'}
          </span>
        </div>
        <div className="text-gray-500 text-xs">{account.account_id} - {account.currency}</div>
      </div>

      <div className="text-white text-sm font-bold shrink-0">
        ${Number(account.balance ?? 0).toFixed(2)}
      </div>

      {isActive && (
        <svg className="w-4 h-4 text-[#2ec7ff] shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  )
}

// ─── Botão de troca de conta ──────────────────────────────────────────────────

function AccountSwitcherButton() {
  const { accounts, currentAccount, setCurrentAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<'real' | 'demo' | null>(null)
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
    setSwitchingTo(account.account_type === 'demo' ? 'demo' : 'real')
    setOpen(false)
    try {
      await setCurrentAccount(account)
      // Pequeno delay para o loader ser visível
      await new Promise(resolve => setTimeout(resolve, 800))
    } finally {
      setSwitching(false)
      setSwitchingTo(null)
    }
  }

  const isDemo = currentAccount?.account_type === 'demo'
  const demoAccounts = accounts.filter(a => a.account_type === 'demo')
  const realAccounts = accounts.filter(a => a.account_type === 'real')

  return (
    <>
      {/* Loader de troca de conta */}
      {switching && switchingTo && (
        <AccountSwitchLoader accountType={switchingTo} />
      )}

      <div ref={ref} className="relative">
        {/* Trigger - Botão "Mudar de Conta" */}
        <button
          onClick={() => setOpen(v => !v)}
          disabled={switching}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold
            transition-all duration-200 select-none
            ${switching ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
            bg-[#1a1f2e] border-[#2a3142] text-gray-300 
            hover:border-[#2ec7ff]/40 hover:text-white
          `}
        >
          {/* Indicador de tipo de conta */}
          <div className={`w-2 h-2 rounded-full ${isDemo ? 'bg-[#2ec7ff]' : 'bg-[#22c55e]'}`} />
          
          {/* Nome da conta atual */}
          <span>
            {currentAccount ? (isDemo ? 'Conta Demo' : 'Conta Real') : 'Selecionar'}
          </span>
          
          <IconChevron open={open} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="
            absolute right-0 top-full mt-2 z-50
            w-72 rounded-xl border border-[#2a3142] shadow-2xl
            bg-[#1a1f2e] overflow-hidden
          ">
            <div className="px-4 py-3 border-b border-[#2a3142]">
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                Mudar de Conta
              </span>
            </div>

            <div className="p-2 max-h-80 overflow-y-auto">
              {accounts.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">
                  Nenhuma conta encontrada
                </p>
              ) : (
                <>
                  {realAccounts.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[#22c55e] text-[10px] uppercase tracking-widest px-3 py-1.5 font-bold">
                        Contas Reais
                      </p>
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
                  {demoAccounts.length > 0 && (
                    <div>
                      <p className="text-[#2ec7ff] text-[10px] uppercase tracking-widest px-3 py-1.5 font-bold">
                        Contas Demo
                      </p>
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── BalanceCard ──────────────────────────────────────────────────────────────

export function BalanceCard() {
  const { balance, profit, wins, losses, currency } = useTrading()

  const isProfit = profit >= 0
  const totalOps = wins + losses
  const winRate = totalOps > 0 ? ((wins / totalOps) * 100) : 0

  return (
    <div
      className="rounded-xl overflow-hidden border border-[#2a3142] shadow-lg"
      style={{ background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)' }}
    >
      <div className="flex">
        {/* Saldo */}
        <div className="flex-1 p-4 bg-[#0d1117]/90 border-r border-[#2a3142]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Saldo</p>
            <AccountSwitcherButton />
          </div>
          <p className="text-white text-2xl font-bold tracking-tight">
            <span className="text-gray-500">$</span>
            <AnimatedNumber 
              value={balance} 
              decimals={2} 
              duration={600}
              className="text-white"
            />
            <span className="text-xs font-normal text-gray-500 ml-1">{currency}</span>
          </p>
        </div>

        {/* Lucro/Prejuízo */}
        <div className="flex-1 p-4 bg-[#1a1f2e]">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
            Lucro/Prejuízo
          </p>
          <p className="text-2xl font-bold tracking-tight">
            <span className="text-gray-500">{isProfit ? '+' : '-'}$</span>
            <AnimatedNumber 
              value={Math.abs(profit)} 
              decimals={2} 
              duration={600}
              colorChange
              className={isProfit ? 'text-[#22c55e]' : 'text-[#ef4444]'}
            />
          </p>
        </div>
      </div>

      {/* Operações e Taxa de Acerto */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-[#0d1117]/50 border-t border-[#2a3142]">
        <span className="text-gray-400 text-xs font-medium">
          Operações{' '}
          <span className="text-[#22c55e] font-bold">{wins}</span>
          <span className="text-gray-600 mx-1">/</span>
          <span className="text-[#ef4444] font-bold">{losses}</span>
        </span>
        <span className="text-gray-400 text-xs font-medium">
          Taxa{' '}
          <AnimatedNumber 
            value={winRate} 
            decimals={1} 
            duration={400}
            suffix="%"
            className={winRate >= 50 ? 'text-[#22c55e] font-bold' : 'text-gray-300 font-bold'}
          />
        </span>
      </div>
    </div>
  )
}
