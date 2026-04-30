'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useTrading } from '@/lib/trading-context'

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v5h5" />
      <path d="M15 12V7h-5" />
      <path d="M13.51 5.87a6 6 0 0 0-10.16 2.14" />
      <path d="M2.49 10.13a6 6 0 0 0 10.16-2.14" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7" />
      <line x1="8" y1="11" x2="8" y2="7" />
      <line x1="8" y1="5" x2="8.01" y2="5" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="8" y1="5" x2="8" y2="19" />
      <line x1="16" y1="5" x2="16" y2="19" />
    </svg>
  )
}

export function ControlsSection() {
  const { accounts, currentAccount, setCurrentAccount } = useAuth()
  const {
    strategies,
    currentStrategy,
    setCurrentStrategy,
    botStatus,
    startBot,
    stopBot,
  } = useTrading()

  const [showAccountDropdown, setShowAccountDropdown]   = useState(false)
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false)
  const [animatedProgress, setAnimatedProgress]         = useState(0)

  const steps = ['Analisando', 'Contrato aberto', 'Contrato fechado']

  const stepMapping: Record<string, number> = {
    idle: -1,
    analyzing: 0,
    contract_open: 1,
    contract_closed: 2,
  }

  const activeStep = stepMapping[botStatus.currentStep] ?? -1

  useEffect(() => {
    if (botStatus.isRunning) {
      const targetProgress = ((activeStep + 1) / steps.length) * 100
      const animate = () => {
        setAnimatedProgress(prev => {
          const diff = targetProgress - prev
          if (Math.abs(diff) < 0.5) return targetProgress
          return prev + diff * 0.1
        })
      }
      const interval = setInterval(animate, 16)
      return () => clearInterval(interval)
    } else {
      setAnimatedProgress(0)
    }
  }, [botStatus.isRunning, activeStep, steps.length])

  const handleBotToggle = async () => {
    if (botStatus.isRunning) await stopBot()
    else await startBot()
  }

  // Só mostra label/cor quando há uma conta selecionada vinda da API
  const accountLabel = currentAccount == null
    ? 'Selecionar'
    : currentAccount.is_virtual
      ? 'Conta Demo'
      : 'Conta Real'

  const accountColor = currentAccount == null
    ? '#6b7280'                                     // cinza — sem conta
    : currentAccount.is_virtual
      ? '#2ec7ff'                                   // azul — demo
      : '#22c55e'                                   // verde — real

  return (
    <div className="space-y-4">
      {/* Botões de Conta, Estratégia e Vídeo */}
      <div className="grid grid-cols-3 gap-3">

        {/* Tipo de Conta */}
        <div className="relative">
          <p className="text-gray-400 text-xs mb-2 font-medium">Tipo de Conta</p>
          <button
            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            className="w-full bg-[#1e2535] hover:bg-[#2a3142] rounded-xl px-3 py-3 flex items-center justify-center gap-2 transition-all border border-[#2a3142] hover:border-[#3a4255]"
          >
            <span className="text-sm font-semibold truncate" style={{ color: accountColor }}>
              {accountLabel}
            </span>
            <span className="text-gray-400 shrink-0"><RefreshIcon /></span>
          </button>

          {showAccountDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e2535] rounded-xl shadow-xl border border-[#2a3142] py-1 z-50">
              {accounts.length === 0 ? (
                // API não conectada ou sem contas — mostra mensagem
                <p className="px-4 py-3 text-xs text-gray-500 text-center">
                  Nenhuma conta disponível
                </p>
              ) : (
                accounts.map((account) => (
                  <button
                    key={account.account_id}
                    onClick={() => {
                      setCurrentAccount(account)
                      setShowAccountDropdown(false)
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#2a3142] transition-colors ${
                      currentAccount?.account_id === account.account_id
                        ? 'text-[#22c55e]'
                        : 'text-white'
                    }`}
                  >
                    {account.is_virtual ? 'Conta Demo' : 'Conta Real'}
                    {' '}
                    <span className="text-gray-400 text-xs">
                      — ${Number(account.balance ?? 0).toFixed(2)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Estratégia */}
        <div className="relative">
          <p className="text-gray-400 text-xs mb-2 font-medium">Estratégia</p>
          <button
            onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
            className="w-full bg-[#1e2535] hover:bg-[#2a3142] rounded-xl px-3 py-3 flex items-center justify-center gap-2 transition-all border border-[#2a3142] hover:border-[#3a4255]"
          >
            <span className="text-white font-semibold text-sm truncate">
              {currentStrategy?.name || 'Selecionar'}
            </span>
            <span className="text-gray-400 shrink-0"><RefreshIcon /></span>
          </button>

          {showStrategyDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e2535] rounded-xl shadow-xl border border-[#2a3142] py-1 z-50">
              {strategies.map((strategy) => (
                <button
                  key={strategy.id}
                  onClick={() => {
                    setCurrentStrategy(strategy)
                    setShowStrategyDropdown(false)
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#2a3142] transition-colors ${
                    currentStrategy?.id === strategy.id ? 'text-[#22c55e]' : 'text-white'
                  }`}
                >
                  {strategy.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vídeo Aula */}
        <div>
          <p className="text-gray-400 text-xs mb-2 font-medium">Vídeo Aula</p>
          <button className="w-full bg-[#dc2626] hover:bg-[#b91c1c] rounded-xl px-3 py-3 flex items-center justify-center gap-2 transition-all">
            <span className="text-white"><PlayIcon /></span>
            <span className="text-white"><InfoIcon /></span>
          </button>
        </div>
      </div>

      {/* Botão Pause/Play e Progress Steps */}
      <div className="flex items-center gap-4">
        {/* Botão Pause/Play */}
        <button
          onClick={handleBotToggle}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 ${
            botStatus.isRunning
              ? 'border-2 border-[#dc2626] bg-transparent hover:bg-[#dc2626]/10'
              : 'border-2 border-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20'
          }`}
        >
          {botStatus.isRunning ? (
            <span className="text-[#dc2626]"><PauseIcon /></span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e">
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
          )}
        </button>

        {/* Progress Steps */}
        <div className="flex-1 min-w-0">
          {/* Labels */}
          <div className="flex justify-between mb-2">
            {steps.map((step, index) => (
              <span
                key={step}
                className={`text-[10px] sm:text-xs font-medium transition-colors duration-300 ${
                  index <= activeStep ? 'text-white' : 'text-gray-600'
                }`}
              >
                {step}
              </span>
            ))}
          </div>

          {/* Progress bar com círculos */}
          <div className="relative h-1 bg-[#2a3142] rounded-full">
            {/* Barra de progresso animada */}
            <div
              className="absolute h-full bg-[#3b82f6] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${animatedProgress}%` }}
            />

            {/* Círculos nos pontos */}
            {steps.map((_, index) => {
              const position = (index / (steps.length - 1)) * 100
              const isActive = index <= activeStep
              return (
                <div
                  key={index}
                  className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${
                    isActive
                      ? 'bg-white border-[#3b82f6] scale-110'
                      : 'bg-[#1e2535] border-[#3a4255]'
                  }`}
                  style={{ left: `calc(${position}% - 7px)` }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
