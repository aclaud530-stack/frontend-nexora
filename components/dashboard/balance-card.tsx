'use client'

import { useTrading } from '@/lib/trading-context'
import { useEffect, useState } from 'react'
import { AccountSwitcher, type TradingAccount } from './account-switcher'

export function BalanceCard() {
  const { balance, profit, wins, losses, currency } = useTrading()
  const [displayBalance, setDisplayBalance] = useState(balance)
  const [displayProfit, setDisplayProfit] = useState(profit)

  // Animação suave de mudança de valores
  useEffect(() => {
    const animateValue = (
      start: number,
      end: number,
      setter: (val: number) => void
    ) => {
      const duration = 500
      const startTime = Date.now()

      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeOutQuad = (t: number) => t * (2 - t)
        const current = start + (end - start) * easeOutQuad(progress)
        setter(current)
        if (progress < 1) requestAnimationFrame(animate)
      }

      animate()
    }

    animateValue(displayBalance, balance, setDisplayBalance)
    animateValue(displayProfit, profit, setDisplayProfit)
  }, [balance, profit])

  const isProfit = profit >= 0

  const handleAccountSwitch = (account: TradingAccount) => {
    // O trading-context deve escutar o evento 'account-switch' disparado pelo AccountSwitcher
    // e reconectar o WebSocket com o novo token
    console.log('Conta trocada para:', account.loginid)
  }

  return (
    <div
      className="rounded-xl overflow-hidden border-2 border-[#2a3142] shadow-lg"
      style={{ background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)' }}
    >
      {/* Header com botão de troca de conta */}
      <div className="flex items-center justify-between px-3 sm:px-4 pt-2.5 pb-1">
        <span className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">
          Conta
        </span>
        <AccountSwitcher onSwitch={handleAccountSwitch} />
      </div>

      {/* Saldo + Lucro */}
      <div className="flex">
        {/* Saldo */}
        <div className="flex-1 p-3 sm:p-4 bg-[#0d1117]/90 border-r border-[#2a3142]">
          <p className="text-gray-400 text-xs sm:text-sm mb-0.5 font-medium">Saldo</p>
          <p className="text-white text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
            <span className="text-gray-400">$</span>{' '}
            {displayBalance.toFixed(2)}{' '}
            <span className="text-xs sm:text-sm font-normal text-gray-400">{currency}</span>
          </p>
        </div>

        {/* Lucro/Prejuízo */}
        <div className="flex-1 p-3 sm:p-4 bg-[#1a1f2e]">
          <p className="text-gray-400 text-xs sm:text-sm mb-0.5 font-medium">Lucro/Prejuízo</p>
          <p
            className={`text-lg sm:text-xl md:text-2xl font-bold tracking-tight transition-colors duration-300 ${
              isProfit ? 'text-[#22c55e]' : 'text-[#ef4444]'
            }`}
          >
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
