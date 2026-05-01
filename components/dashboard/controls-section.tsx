'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useTrading } from '@/lib/trading-context'
import { useLoader } from '@/components/loader'

// ─── Icons ────────────────────────────────────────────────────────────────────

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

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Definição de cada campo de configuração por estratégia.
 * Adiciona ou remove campos aqui conforme as tuas estratégias reais.
 */
type FieldType = 'number' | 'select' | 'toggle'

interface StrategyField {
  key: string
  label: string
  type: FieldType
  defaultValue: string | number | boolean
  min?: number
  max?: number
  step?: number
  options?: { value: string; label: string }[]
  description?: string
}

const STRATEGY_FIELDS: Record<string, StrategyField[]> = {
  // Campos padrão para estratégias sem definição específica
  default: [
    {
      key: 'stake',
      label: 'Valor de Entrada (USD)',
      type: 'number',
      defaultValue: 1,
      min: 0.35,
      step: 0.01,
      description: 'Valor apostado por contrato',
    },
    {
      key: 'martingale',
      label: 'Martingale',
      type: 'toggle',
      defaultValue: false,
      description: 'Dobrar entrada após perda',
    },
    {
      key: 'martingale_multiplier',
      label: 'Multiplicador Martingale',
      type: 'number',
      defaultValue: 2,
      min: 1.1,
      step: 0.1,
      description: 'Fator de multiplicação após perda',
    },
    {
      key: 'max_loss',
      label: 'Perda Máxima (USD)',
      type: 'number',
      defaultValue: 10,
      min: 1,
      step: 0.5,
      description: 'Para o bot ao atingir este valor de perda',
    },
    {
      key: 'take_profit',
      label: 'Take Profit (USD)',
      type: 'number',
      defaultValue: 20,
      min: 1,
      step: 0.5,
      description: 'Para o bot ao atingir este lucro',
    },
  ],

  // Exemplo: estratégia "Digit Even/Odd"
  digit_even_odd: [
    {
      key: 'stake',
      label: 'Valor de Entrada (USD)',
      type: 'number',
      defaultValue: 1,
      min: 0.35,
      step: 0.01,
    },
    {
      key: 'digit_type',
      label: 'Tipo de Dígito',
      type: 'select',
      defaultValue: 'even',
      options: [
        { value: 'even', label: 'Par (Even)' },
        { value: 'odd', label: 'Ímpar (Odd)' },
      ],
    },
    {
      key: 'martingale',
      label: 'Martingale',
      type: 'toggle',
      defaultValue: false,
    },
    {
      key: 'max_loss',
      label: 'Perda Máxima (USD)',
      type: 'number',
      defaultValue: 10,
      min: 1,
      step: 0.5,
    },
    {
      key: 'take_profit',
      label: 'Take Profit (USD)',
      type: 'number',
      defaultValue: 20,
      min: 1,
      step: 0.5,
    },
  ],

  // Exemplo: estratégia "Rise/Fall"
  rise_fall: [
    {
      key: 'stake',
      label: 'Valor de Entrada (USD)',
      type: 'number',
      defaultValue: 1,
      min: 0.35,
      step: 0.01,
    },
    {
      key: 'direction',
      label: 'Direcção',
      type: 'select',
      defaultValue: 'rise',
      options: [
        { value: 'rise', label: 'Subida (Rise)' },
        { value: 'fall', label: 'Descida (Fall)' },
      ],
    },
    {
      key: 'duration',
      label: 'Duração (ticks)',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 10,
      step: 1,
    },
    {
      key: 'martingale',
      label: 'Martingale',
      type: 'toggle',
      defaultValue: false,
    },
    {
      key: 'martingale_multiplier',
      label: 'Multiplicador Martingale',
      type: 'number',
      defaultValue: 2,
      min: 1.1,
      step: 0.1,
    },
    {
      key: 'max_loss',
      label: 'Perda Máxima (USD)',
      type: 'number',
      defaultValue: 10,
      min: 1,
      step: 0.5,
    },
    {
      key: 'take_profit',
      label: 'Take Profit (USD)',
      type: 'number',
      defaultValue: 20,
      min: 1,
      step: 0.5,
    },
  ],
}

// ─── Painel de Configurações ──────────────────────────────────────────────────

interface SettingsPanelProps {
  strategyId: string
  strategyName: string
  onClose: () => void
  onSave: (values: Record<string, string | number | boolean>) => void
  savedValues: Record<string, string | number | boolean>
}

function SettingsPanel({ strategyId, strategyName, onClose, onSave, savedValues }: SettingsPanelProps) {
  const fields = STRATEGY_FIELDS[strategyId] ?? STRATEGY_FIELDS.default

  // Inicializa com valores guardados ou defaults
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() => {
    const init: Record<string, string | number | boolean> = {}
    fields.forEach(f => {
      init[f.key] = savedValues[f.key] !== undefined ? savedValues[f.key] : f.defaultValue
    })
    return init
  })

  const handleChange = (key: string, value: string | number | boolean) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSave(values)
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Painel */}
      <div className="fixed inset-x-4 top-4 z-50 max-w-md mx-auto">
        <div className="bg-[#151b2e] border border-[#2a3142] rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3142] bg-[#1a2235]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#2a3142] flex items-center justify-center text-[#3b82f6]">
                <GearIcon />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Configurações</p>
                <p className="text-gray-500 text-xs leading-tight">{strategyName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#2a3142] hover:bg-[#3a4255] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Campos */}
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {fields.map(field => (
              <div key={field.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-gray-300 text-xs font-medium">{field.label}</label>
                  {field.type === 'toggle' && (
                    <button
                      onClick={() => handleChange(field.key, !values[field.key])}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                        values[field.key] ? 'bg-[#3b82f6]' : 'bg-[#2a3142]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                          values[field.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  )}
                </div>

                {field.type === 'number' && (
                  <input
                    type="number"
                    value={values[field.key] as number}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    onChange={e => handleChange(field.key, parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#1e2535] border border-[#2a3142] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
                  />
                )}

                {field.type === 'select' && (
                  <select
                    value={values[field.key] as string}
                    onChange={e => handleChange(field.key, e.target.value)}
                    className="w-full bg-[#1e2535] border border-[#2a3142] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6] transition-colors appearance-none cursor-pointer"
                  >
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-[#1e2535]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}

                {field.description && field.type !== 'toggle' && (
                  <p className="text-gray-600 text-[10px] mt-1">{field.description}</p>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#2a3142] bg-[#1a2235] flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-[#2a3142] hover:bg-[#3a4255] text-gray-300 hover:text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── ControlsSection ──────────────────────────────────────────────────────────

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

  const loader = useLoader()

  const [showAccountDropdown, setShowAccountDropdown]   = useState(false)
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false)
  const [showSettings, setShowSettings]                 = useState(false)
  const [animatedProgress, setAnimatedProgress]         = useState(0)

  // Guarda os valores de configuração por estratégia
  const [strategySettings, setStrategySettings] = useState<
    Record<string, Record<string, string | number | boolean>>
  >({})

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

  const handleAccountSelect = async (account: typeof accounts[number]) => {
    setShowAccountDropdown(false)
    if (currentAccount?.account_id === account.account_id) return

    const label = account.is_virtual ? 'Conta Demo' : 'Conta Real'
    loader.show(`A ligar a ${label}…`)

    try {
      await setCurrentAccount(account)
      loader.complete(`${label} activa!`)
    } catch (err) {
      console.error('Erro ao trocar conta:', err)
      loader.hide()
    }
  }

  const handleSaveSettings = (values: Record<string, string | number | boolean>) => {
    if (!currentStrategy) return
    setStrategySettings(prev => ({
      ...prev,
      [currentStrategy.id]: values,
    }))
    // Aqui podes também persistir via backend/localStorage se necessário
  }

  const currentSettings = currentStrategy
    ? (strategySettings[currentStrategy.id] ?? {})
    : {}

  const accountLabel = currentAccount == null
    ? 'Selecionar'
    : currentAccount.is_virtual
      ? 'Conta Demo'
      : 'Conta Real'

  const accountColor = currentAccount == null
    ? '#6b7280'
    : currentAccount.is_virtual
      ? '#2ec7ff'
      : '#22c55e'

  return (
    <>
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
                  <p className="px-4 py-3 text-xs text-gray-500 text-center">
                    Nenhuma conta disponível
                  </p>
                ) : (
                  accounts.map((account) => (
                    <button
                      key={account.account_id}
                      onClick={() => handleAccountSelect(account)}
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

        {/* Botão Engrenagem + Pause/Play + Progress Steps */}
        <div className="flex items-center gap-4">

          {/* Botão Engrenagem */}
          <button
            onClick={() => setShowSettings(true)}
            title="Configurações da estratégia"
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 border-2 border-[#2a3142] bg-[#1e2535] hover:bg-[#2a3142] hover:border-[#3b82f6] text-gray-400 hover:text-[#3b82f6]"
          >
            <GearIcon />
          </button>

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
              <div
                className="absolute h-full bg-[#3b82f6] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${animatedProgress}%` }}
              />
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

      {/* Painel de Configurações — renderizado fora do flow para não quebrar layout */}
      {showSettings && currentStrategy && (
        <SettingsPanel
          strategyId={currentStrategy.id}
          strategyName={currentStrategy.name}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          savedValues={currentSettings}
        />
      )}
    </>
  )
}
