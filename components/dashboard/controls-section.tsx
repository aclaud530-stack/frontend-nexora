'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useTrading } from '@/lib/trading-context'

// Ícone de refresh customizado
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

// Ícone de play customizado
function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  )
}

// Ícone de info customizado
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7" />
      <line x1="8" y1="11" x2="8" y2="7" />
      <line x1="8" y1="5" x2="8.01" y2="5" />
    </svg>
  )
}

// Ícone de pause customizado
function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
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
    stopBot 
  } = useTrading()
  
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false)
  const [animatedProgress, setAnimatedProgress] = useState(0)

  const steps = ['Analisando', 'Contrato aberto', 'Contrato fechado']

  // Mapear status do bot para step
  const stepMapping: Record<string, number> = {
    'idle': -1,
    'analyzing': 0,
    'contract_open': 1,
    'contract_closed': 2,
  }

  const activeStep = stepMapping[botStatus.currentStep] ?? -1

  // Animar progresso
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
  }, [botStatus.isRunning, activeStep])

  const handleBotToggle = async () => {
    if (botStatus.isRunning) {
      await stopBot()
    } else {
      await startBot()
    }
  }

  // Nome da conta formatado
  const accountLabel = currentAccount?.is_virtual ? 'Conta Demo' : 'Conta Real'

  return (
    <div className="space-y-3">
      {/* Botões de Conta, Estratégia e Vídeo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Tipo de Conta */}
        <div className="relative">
          <p className="text-gray-400 text-xs sm:text-sm mb-1.5 font-medium">Tipo de Conta</p>
          <button 
            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            className="w-full bg-[#2a3142] hover:bg-[#374151] rounded-lg sm:rounded-xl px-2 sm:px-3 py-2.5 flex items-center justify-center gap-1.5 transition-colors border-2 border-[#374151]"
          >
            <span className={`text-xs sm:text-sm font-semibold truncate ${currentAccount?.is_virtual ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
              {accountLabel}
            </span>
            <span className="text-gray-400 shrink-0"><RefreshIcon /></span>
          </button>
          
          {showAccountDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#2a3142] rounded-lg shadow-xl border-2 border-[#374151] py-1 z-50">
              {accounts.map((account) => (
                <button
                  key={account.account_id}
                  onClick={() => {
                    setCurrentAccount(account)
                    setShowAccountDropdown(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-xs sm:text-sm hover:bg-[#374151] transition-colors ${
                    currentAccount?.account_id === account.account_id ? 'text-[#22d3ee]' : 'text-white'
                  }`}
                >
                  {account.is_virtual ? 'Demo' : 'Real'} - ${account.balance.toFixed(2)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Estratégia */}
        <div className="relative">
          <p className="text-gray-400 text-xs sm:text-sm mb-1.5 font-medium">Estratégia</p>
          <button 
            onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
            className="w-full bg-[#2a3142] hover:bg-[#374151] rounded-lg sm:rounded-xl px-2 sm:px-3 py-2.5 flex items-center justify-center gap-1.5 transition-colors border-2 border-[#374151]"
          >
            <span className="text-white font-semibold text-xs sm:text-sm truncate">
              {currentStrategy?.name || 'Selecionar'}
            </span>
            <span className="text-gray-400 shrink-0"><RefreshIcon /></span>
          </button>
          
          {showStrategyDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#2a3142] rounded-lg shadow-xl border-2 border-[#374151] py-1 z-50">
              {strategies.map((strategy) => (
                <button
                  key={strategy.id}
                  onClick={() => {
                    setCurrentStrategy(strategy)
                    setShowStrategyDropdown(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-xs sm:text-sm hover:bg-[#374151] transition-colors ${
                    currentStrategy?.id === strategy.id ? 'text-[#22d3ee]' : 'text-white'
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
          <p className="text-gray-400 text-xs sm:text-sm mb-1.5 font-medium">Vídeo Aula</p>
          <button className="w-full bg-[#dc2626] hover:bg-[#b91c1c] rounded-lg sm:rounded-xl px-2 sm:px-3 py-2.5 flex items-center justify-center gap-1.5 transition-colors border-2 border-[#dc2626]">
            <span className="text-white"><PlayIcon /></span>
            <span className="text-white"><InfoIcon /></span>
          </button>
        </div>
      </div>

      {/* Botão Pause e Progress Steps */}
      <div className="flex items-center gap-3">
        {/* Botão Play/Pause */}
        <button
          onClick={handleBotToggle}
          className={`p-2 rounded-lg border-2 transition-all duration-200 flex items-center justify-center shrink-0 ${
            botStatus.isRunning 
              ? 'border-[#dc2626] bg-transparent' 
              : 'border-[#22c55e] bg-[#22c55e]/10'
          }`}
          style={{ width: '40px', height: '40px' }}
        >
          {botStatus.isRunning ? (
            <span className="text-[#dc2626]"><PauseIcon /></span>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#22c55e">
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
          )}
        </button>

        {/* Progress Steps */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between mb-1.5">
            {steps.map((step, index) => (
              <span
                key={step}
                className={`text-[10px] sm:text-xs font-medium truncate transition-colors duration-300 ${
                  index <= activeStep ? 'text-white' : 'text-gray-500'
                }`}
              >
                {step}
              </span>
            ))}
          </div>
          
          {/* Progress Track */}
          <div className="relative h-[3px] bg-[#374151] rounded-full overflow-hidden">
            <div 
              className="absolute h-full bg-[#3b82f6] rounded-full transition-all duration-500"
              style={{ width: `${animatedProgress}%` }}
            />
            
            {/* Progress Dots */}
            {steps.map((_, index) => {
              const position = (index / (steps.length - 1)) * 100
              return (
                <div
                  key={index}
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-[2px] transition-all duration-300 ${
                    index <= activeStep
                      ? 'bg-white border-[#3b82f6]'
                      : 'bg-[#374151] border-[#374151]'
                  }`}
                  style={{ left: `calc(${position}% - 6px)` }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
