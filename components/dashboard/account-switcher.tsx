'use client'

import { useState, useEffect, useRef } from 'react'
import { useTrading } from '@/lib/trading-context'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TradingAccount {
  loginid: string
  account_type: 'real' | 'demo'
  balance: number
  currency: string
  token: string
  is_virtual: boolean
  landing_company_shortcode?: string
}

// ── Hook para gerir contas via API ────────────────────────────────────────────

export function useAccountSwitcher() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([])
  const [activeAccount, setActiveAccountState] = useState<TradingAccount | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carregar contas do localStorage (populadas pelo WebSocket de autorização)
  useEffect(() => {
    const stored = localStorage.getItem('trading_accounts')
    const active = localStorage.getItem('active_account')

    if (stored) {
      try {
        const parsed: TradingAccount[] = JSON.parse(stored)
        setAccounts(parsed)
        if (active) {
          const found = parsed.find(a => a.loginid === active)
          if (found) setActiveAccountState(found)
          else if (parsed.length > 0) setActiveAccountState(parsed[0])
        } else if (parsed.length > 0) {
          setActiveAccountState(parsed[0])
        }
      } catch {
        console.error('Erro ao carregar contas')
      }
    }
  }, [])

  // Trocar de conta — re-autoriza o WebSocket com o novo token
  const switchAccount = async (account: TradingAccount) => {
    setIsLoading(true)
    setError(null)
    try {
      // Guarda conta activa
      localStorage.setItem('active_account', account.loginid)
      localStorage.setItem('token', account.token)

      setActiveAccountState(account)

      // Dispara evento customizado para o contexto de trading reconectar
      window.dispatchEvent(new CustomEvent('account-switch', { detail: account }))
    } catch (e) {
      setError('Erro ao trocar de conta')
    } finally {
      setIsLoading(false)
    }
  }

  // Popular contas a partir da resposta da API (chamar após autorização)
  const populateAccounts = (apiAccounts: TradingAccount[]) => {
    setAccounts(apiAccounts)
    localStorage.setItem('trading_accounts', JSON.stringify(apiAccounts))
  }

  return { accounts, activeAccount, isLoading, error, switchAccount, populateAccounts }
}

// ── Componente AccountSwitcher ────────────────────────────────────────────────

interface AccountSwitcherProps {
  onSwitch?: (account: TradingAccount) => void
}

export function AccountSwitcher({ onSwitch }: AccountSwitcherProps) {
  const { accounts, activeAccount, isLoading, switchAccount } = useAccountSwitcher()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSwitch = async (account: TradingAccount) => {
    await switchAccount(account)
    onSwitch?.(account)
    setIsOpen(false)
  }

  const realAccounts  = accounts.filter(a => !a.is_virtual)
  const demoAccounts  = accounts.filter(a => a.is_virtual)
  const isDemo        = activeAccount?.is_virtual ?? false

  return (
    <div ref={dropdownRef} className="relative">

      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200
          ${isDemo
            ? 'border-[#f59e0b] bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 text-[#f59e0b]'
            : 'border-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e]'
          }
        `}
      >
        {/* Indicador tipo */}
        <span className={`w-2 h-2 rounded-full ${isDemo ? 'bg-[#f59e0b]' : 'bg-[#22c55e]'} ${isLoading ? 'animate-pulse' : ''}`} />

        <span className="text-xs font-bold tracking-wider">
          {isLoading ? 'A trocar...' : isDemo ? 'DEMO' : 'REAL'}
        </span>

        {activeAccount && (
          <span className="text-xs opacity-70 hidden sm:inline">
            {activeAccount.loginid}
          </span>
        )}

        {/* Chevron */}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="
          absolute right-0 top-full mt-2 z-50
          bg-[#131825] border border-[#2a3142] rounded-xl shadow-2xl
          min-w-[240px] overflow-hidden
          animate-in fade-in slide-in-from-top-2 duration-150
        ">

          {/* Contas Reais */}
          {realAccounts.length > 0 && (
            <div>
              <div className="px-3 py-2 border-b border-[#2a3142]">
                <span className="text-[10px] font-bold tracking-widest text-[#22c55e] uppercase">
                  Contas Reais
                </span>
              </div>
              {realAccounts.map(acc => (
                <AccountRow
                  key={acc.loginid}
                  account={acc}
                  isActive={activeAccount?.loginid === acc.loginid}
                  onSelect={() => handleSwitch(acc)}
                />
              ))}
            </div>
          )}

          {/* Contas Demo */}
          {demoAccounts.length > 0 && (
            <div>
              <div className={`px-3 py-2 border-b border-[#2a3142] ${realAccounts.length > 0 ? 'border-t' : ''}`}>
                <span className="text-[10px] font-bold tracking-widest text-[#f59e0b] uppercase">
                  Contas Demo
                </span>
              </div>
              {demoAccounts.map(acc => (
                <AccountRow
                  key={acc.loginid}
                  account={acc}
                  isActive={activeAccount?.loginid === acc.loginid}
                  onSelect={() => handleSwitch(acc)}
                />
              ))}
            </div>
          )}

          {/* Sem contas */}
          {accounts.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-gray-500 text-sm">Sem contas disponíveis</p>
              <p className="text-gray-600 text-xs mt-1">Reconectar à API</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Linha de conta no dropdown ─────────────────────────────────────────────────

function AccountRow({
  account,
  isActive,
  onSelect,
}: {
  account: TradingAccount
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center justify-between px-3 py-2.5
        transition-colors duration-150
        ${isActive
          ? 'bg-[#1e2535] cursor-default'
          : 'hover:bg-[#1a2030] cursor-pointer'
        }
      `}
    >
      <div className="flex items-center gap-2.5">
        {/* Dot */}
        <span className={`w-1.5 h-1.5 rounded-full ${account.is_virtual ? 'bg-[#f59e0b]' : 'bg-[#22c55e]'}`} />

        <div className="text-left">
          <p className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray-300'}`}>
            {account.loginid}
          </p>
          <p className="text-[10px] text-gray-500">
            {account.landing_company_shortcode?.toUpperCase() || (account.is_virtual ? 'DEMO' : 'REAL')}
          </p>
        </div>
      </div>

      <div className="text-right flex items-center gap-2">
        <div>
          <p className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>
            {account.balance.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-500">{account.currency}</p>
        </div>

        {isActive && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7L5.5 10L11.5 4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </button>
  )
}
