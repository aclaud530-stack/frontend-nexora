'use client'

// ============================================================
// NEXORA FOREX — Controls Section
// Cria bots via createBot(), controla via startBot/stopBot/
// pauseBot/resumeBot. Modal em 3 passos com todos os campos
// de BotConfig + strategyParams vindos de nexora.types.ts
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useTrading } from '@/lib/trading-context'
import { useBots } from '@/lib/bots-context'
import {
  BotSummary, BotStrategyType, BotConfig,
  COMMON_CONFIG_FIELDS, STRATEGY_PARAMS_FIELDS, STRATEGY_LABELS, StrategyFieldDef,
} from '@/lib/nexora.types'
import { useLoader } from '@/components/loader'

// ─── Icons ────────────────────────────────────────────────────
const Ico = {
  Refresh: ({ spin }: { spin?: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={spin ? 'animate-spin' : ''}>
      <path d="M1 4v5h5"/><path d="M15 12V7h-5"/>
      <path d="M13.51 5.87a6 6 0 0 0-10.16 2.14"/><path d="M2.49 10.13a6 6 0 0 0 10.16-2.14"/>
    </svg>
  ),
  Play: () => <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>,
  Info: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7"/><line x1="8" y1="11" x2="8" y2="7"/><line x1="8" y1="5" x2="8.01" y2="5"/>
    </svg>
  ),
  Pause: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="8" y1="5" x2="8" y2="19"/><line x1="16" y1="5" x2="16" y2="19"/>
    </svg>
  ),
  Gear: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
}

// ─── WS status dot ────────────────────────────────────────────
function WsDot({ status }: { status: string }) {
  const c = status === 'connected' ? '#22c55e' : status === 'connecting' ? '#f59e0b' : '#ef4444'
  return (
    <span className="w-2 h-2 rounded-full shrink-0 transition-colors"
      style={{ background: c, boxShadow: status === 'connected' ? `0 0 5px ${c}88` : 'none' }}
      title={`WebSocket: ${status}`}
    />
  )
}

// ─── Campo de formulário ──────────────────────────────────────
function Field({ f, value, onChange }: { f: StrategyFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (f.type === 'toggle') {
    return (
      <button type="button" onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-[#3b82f6]' : 'bg-[#2a3142]'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    )
  }
  if (f.type === 'select') {
    return (
      <select value={value as string} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#1e2535] border border-[#2a3142] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6] appearance-none cursor-pointer">
        {f.options?.map(o => <option key={o.value} value={o.value} className="bg-[#1e2535]">{o.label}</option>)}
      </select>
    )
  }
  return (
    <input type="number" value={value as number} min={f.min} max={f.max} step={f.step ?? 1}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full bg-[#1e2535] border border-[#2a3142] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6]" />
  )
}

// ─── Modal criar bot (3 passos) ───────────────────────────────
const STRATEGIES: { value: BotStrategyType; label: string; desc: string }[] = [
  { value: 'scalping',        label: 'Scalping',        desc: 'Muitas operações rápidas com baixo risco' },
  { value: 'martingale',      label: 'Martingale',      desc: 'Dobra stake após perda, reseta no win' },
  { value: 'anti_martingale', label: 'Anti-Martingale', desc: 'Dobra stake após win, reseta na perda' },
  { value: 'trend_following', label: 'Trend Following', desc: 'Segue a tendência do mercado' },
]

function initVals(fields: StrategyFieldDef[]) {
  const v: Record<string, unknown> = {}
  fields.forEach(f => { v[f.key] = f.defaultValue })
  return v
}

interface BotModalProps {
  onClose:  () => void
  onCreate: (name: string, strategy: BotStrategyType, config: BotConfig) => void
}

function BotModal({ onClose, onCreate }: BotModalProps) {
  const [step,     setStep]     = useState<0 | 1 | 2>(0)
  const [botName,  setBotName]  = useState('')
  const [strategy, setStrategy] = useState<BotStrategyType>('martingale')
  const [cfgVals,  setCfgVals]  = useState<Record<string, unknown>>(() => initVals(COMMON_CONFIG_FIELDS))
  const [prmVals,  setPrmVals]  = useState<Record<string, unknown>>(() => initVals(STRATEGY_PARAMS_FIELDS['martingale']))

  useEffect(() => { setPrmVals(initVals(STRATEGY_PARAMS_FIELDS[strategy])) }, [strategy])

  const configGroups = useMemo(() => {
    const g: Record<string, StrategyFieldDef[]> = {}
    COMMON_CONFIG_FIELDS.forEach(f => {
      const k = f.group ?? 'Geral'
      if (!g[k]) g[k] = []
      g[k].push(f)
    })
    return g
  }, [])

  const handleCreate = () => {
    const config: BotConfig = {
      symbol:        cfgVals.symbol as string,
      contractType:  cfgVals.contractType as string,
      duration:      cfgVals.duration as number,
      durationUnit:  cfgVals.durationUnit as BotConfig['durationUnit'],
      initialStake:  cfgVals.initialStake as number,
      currency:      'USD',
      maxTrades:     cfgVals.maxTrades as number,
      maxLoss:       cfgVals.maxLoss as number,
      maxProfit:     cfgVals.maxProfit as number,
      strategyParams: prmVals,
    }
    onCreate(botName.trim(), strategy, config)
    onClose()
  }

  const STEP_LABELS = ['Básico', 'Contrato & Risco', 'Estratégia']

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-4 z-50 max-w-lg mx-auto">
        <div className="bg-[#151b2e] border border-[#2a3142] rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3142] bg-[#1a2235]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/15 border border-[#3b82f6]/30 flex items-center justify-center text-[#3b82f6]">
                <Ico.Plus />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Criar novo bot</p>
                <p className="text-gray-500 text-xs">{STEP_LABELS[step]} — passo {step + 1} de {STEP_LABELS.length}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#2a3142] hover:bg-[#3a4255] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <Ico.Close />
            </button>
          </div>

          {/* Step bar */}
          <div className="flex items-center gap-0 px-5 pt-4 pb-1">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${i <= step ? 'bg-[#3b82f6] text-white' : 'bg-[#2a3142] text-gray-500'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] ml-1 mr-2 transition-colors ${i === step ? 'text-white' : 'text-gray-600'}`}>{label}</span>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`flex-1 h-px mr-2 transition-colors ${i < step ? 'bg-[#3b82f6]' : 'bg-[#2a3142]'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Conteúdo */}
          <div className="px-5 py-4 max-h-[62vh] overflow-y-auto space-y-4">

            {/* Passo 0: nome + estratégia */}
            {step === 0 && (
              <>
                <div>
                  <label className="text-gray-300 text-xs font-medium mb-1.5 block">Nome do Bot</label>
                  <input
                    autoFocus
                    type="text" value={botName} onChange={e => setBotName(e.target.value)}
                    placeholder="ex: Martingale Pro"
                    className="w-full bg-[#1e2535] border border-[#2a3142] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6] placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <label className="text-gray-300 text-xs font-medium mb-2 block">Estratégia</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STRATEGIES.map(s => (
                      <button key={s.value} type="button" onClick={() => setStrategy(s.value)}
                        className={`px-3 py-3 rounded-xl text-left transition-colors border ${
                          strategy === s.value
                            ? 'bg-[#3b82f6]/15 border-[#3b82f6]'
                            : 'bg-[#1e2535] border-[#2a3142] hover:border-[#3a4255]'
                        }`}>
                        <p className={`text-sm font-semibold ${strategy === s.value ? 'text-[#3b82f6]' : 'text-white'}`}>{s.label}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Passo 1: BotConfig (símbolo, contrato, risco) */}
            {step === 1 && Object.entries(configGroups).map(([group, fields]) => (
              <div key={group}>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-3">{group}</p>
                <div className="space-y-3">
                  {fields.map(f => (
                    <div key={f.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-gray-300 text-xs font-medium">{f.label}</label>
                        {f.type === 'toggle' && (
                          <Field f={f} value={cfgVals[f.key]} onChange={v => setCfgVals(p => ({...p, [f.key]: v}))} />
                        )}
                      </div>
                      {f.type !== 'toggle' && (
                        <Field f={f} value={cfgVals[f.key]} onChange={v => setCfgVals(p => ({...p, [f.key]: v}))} />
                      )}
                      {f.description && <p className="text-gray-600 text-[10px] mt-1">{f.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Passo 2: strategyParams */}
            {step === 2 && (
              STRATEGY_PARAMS_FIELDS[strategy].length === 0
                ? <p className="text-gray-500 text-sm text-center py-6">Esta estratégia não tem parâmetros adicionais</p>
                : STRATEGY_PARAMS_FIELDS[strategy].map(f => (
                  <div key={f.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <label className="text-gray-300 text-xs font-medium">{f.label}</label>
                        {f.description && <p className="text-gray-600 text-[10px]">{f.description}</p>}
                      </div>
                      {f.type === 'toggle' && (
                        <Field f={f} value={prmVals[f.key]} onChange={v => setPrmVals(p => ({...p, [f.key]: v}))} />
                      )}
                    </div>
                    {f.type !== 'toggle' && (
                      <Field f={f} value={prmVals[f.key]} onChange={v => setPrmVals(p => ({...p, [f.key]: v}))} />
                    )}
                  </div>
                ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#2a3142] bg-[#1a2235] flex gap-3">
            {step > 0
              ? <button onClick={() => setStep((step - 1) as 0 | 1 | 2)} className="px-5 py-2.5 bg-[#2a3142] hover:bg-[#3a4255] text-gray-300 rounded-xl text-sm font-medium transition-colors">← Voltar</button>
              : <button onClick={onClose} className="flex-1 bg-[#2a3142] hover:bg-[#3a4255] text-gray-300 rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
            }
            {step < 2
              ? (
                <button
                  disabled={step === 0 && !botName.trim()}
                  onClick={() => setStep((step + 1) as 0 | 1 | 2)}
                  className="flex-1 bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
                >Próximo →</button>
              ) : (
                <button onClick={handleCreate} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
                  ✓ Criar Bot
                </button>
              )
            }
          </div>
        </div>
      </div>
    </>
  )
}

// ─── ControlsSection ──────────────────────────────────────────
export function ControlsSection() {
  const { accounts, currentAccount, setCurrentAccount } = useAuth()
  const { botStatus } = useTrading()
  const { bots, wsStatus, isLoadingBots, lastError, createBot, startBot, stopBot, pauseBot, resumeBot, listBots, openTrades } = useBots()
  const loader = useLoader()

  const [showAccDrop,  setShowAccDrop]  = useState(false)
  const [showBotDrop,  setShowBotDrop]  = useState(false)
  const [showModal,    setShowModal]    = useState(false)
  const [selectedBot,  setSelectedBot]  = useState<BotSummary | null>(null)
  const [animProgress, setAnimProgress] = useState(0)

  // Sincronizar bot seleccionado
  useEffect(() => {
    if (!selectedBot && bots.length > 0) { setSelectedBot(bots[0]); return }
    if (selectedBot) {
      const updated = bots.find(b => b.id === selectedBot.id)
      if (updated) setSelectedBot(updated)
    }
  }, [bots])

  const isRunning = selectedBot?.status === 'running'
  const isPaused  = selectedBot?.status === 'paused'
  const openCount = Object.keys(openTrades).length

  // Progress bar animation
  const stepMapping: Record<string, number> = { idle: -1, analyzing: 0, contract_open: 1, contract_closed: 2 }
  const activeStep = stepMapping[botStatus?.currentStep ?? 'idle'] ?? (isRunning ? 0 : -1)
  const steps = ['Analisando', 'Contrato aberto', 'Contrato fechado']

  useEffect(() => {
    const target = isRunning ? ((activeStep + 1) / steps.length) * 100 : 0
    const id = setInterval(() => setAnimProgress(p => {
      const d = target - p
      return Math.abs(d) < 0.5 ? target : p + d * 0.1
    }), 16)
    return () => clearInterval(id)
  }, [isRunning, activeStep])

  const handleToggle = () => {
    if (!selectedBot) return
    if (isRunning)     stopBot(selectedBot.id)
    else if (isPaused) resumeBot(selectedBot.id)
    else               startBot(selectedBot.id)
  }

  const handleAccSelect = async (acc: typeof accounts[number]) => {
    setShowAccDrop(false)
    if (currentAccount?.account_id === acc.account_id) return
    const label = acc.is_virtual ? 'Conta Demo' : 'Conta Real'
    loader.show(`A ligar a ${label}…`)
    try { await setCurrentAccount(acc); loader.complete(`${label} activa!`) }
    catch { loader.hide() }
  }

  const statusDot = (s?: string) => ({
    running: '#22c55e', paused: '#f59e0b', error: '#ef4444',
  }[s ?? ''] ?? '#4b5563')

  const accLabel = !currentAccount ? 'Selecionar' : currentAccount.is_virtual ? 'Demo' : 'Real'
  const accColor = !currentAccount ? '#6b7280' : currentAccount.is_virtual ? '#2ec7ff' : '#22c55e'

  return (
    <>
      <div className="space-y-4">

        {/* Banner de erro */}
        {lastError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-xs animate-pulse">
            ⚠ {lastError}
          </div>
        )}

        {/* Grid 3 colunas */}
        <div className="grid grid-cols-3 gap-3">

          {/* Conta */}
          <div className="relative">
            <p className="text-gray-400 text-xs mb-2 font-medium">Tipo de Conta</p>
            <button onClick={() => setShowAccDrop(!showAccDrop)}
              className="w-full bg-[#1e2535] hover:bg-[#2a3142] rounded-xl px-3 py-3 flex items-center justify-center gap-2 border border-[#2a3142] transition-all">
              <span className="text-sm font-semibold truncate" style={{ color: accColor }}>{accLabel}</span>
              <Ico.Refresh />
            </button>
            {showAccDrop && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e2535] rounded-xl shadow-xl border border-[#2a3142] py-1 z-50">
                {accounts.map(a => (
                  <button key={a.account_id} onClick={() => handleAccSelect(a)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#2a3142] transition-colors ${currentAccount?.account_id === a.account_id ? 'text-[#22c55e]' : 'text-white'}`}>
                    {a.is_virtual ? 'Conta Demo' : 'Conta Real'}
                    <span className="text-gray-400 text-xs"> — ${Number(a.balance ?? 0).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bot (lista do BotManager) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-xs font-medium">Bot</p>
              <div className="flex items-center gap-2">
                <WsDot status={wsStatus} />
                <button onClick={listBots} title="Recarregar" className="text-gray-500 hover:text-gray-300 transition-colors">
                  <Ico.Refresh spin={isLoadingBots} />
                </button>
                <button onClick={() => setShowModal(true)} title="Criar bot" className="text-gray-500 hover:text-[#3b82f6] transition-colors">
                  <Ico.Plus />
                </button>
              </div>
            </div>
            <button onClick={() => setShowBotDrop(!showBotDrop)}
              className="w-full bg-[#1e2535] hover:bg-[#2a3142] rounded-xl px-3 py-3 flex items-center gap-2 border border-[#2a3142] transition-all min-w-0">
              {selectedBot ? (
                <>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusDot(selectedBot.status) }} />
                  <span className="text-white font-semibold text-sm truncate">{selectedBot.name}</span>
                  <span className="text-gray-500 text-[10px] ml-auto shrink-0 capitalize hidden sm:block">
                    {STRATEGY_LABELS[selectedBot.strategy]}
                  </span>
                </>
              ) : (
                <span className="text-gray-400 text-sm">{isLoadingBots ? 'A carregar…' : 'Selecionar'}</span>
              )}
            </button>
            {showBotDrop && bots.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e2535] rounded-xl shadow-xl border border-[#2a3142] py-1 z-50 max-h-56 overflow-y-auto">
                {bots.map(b => (
                  <button key={b.id} onClick={() => { setSelectedBot(b); setShowBotDrop(false) }}
                    className={`w-full px-4 py-2.5 text-left hover:bg-[#2a3142] transition-colors ${selectedBot?.id === b.id ? 'bg-[#2a3142]/50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusDot(b.status) }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate">{b.name}</p>
                        <p className="text-[10px] text-gray-500">{STRATEGY_LABELS[b.strategy]} · {b.stats.totalTrades} trades</p>
                      </div>
                      <span className={`text-xs font-bold font-mono shrink-0 ${b.stats.netPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {b.stats.netPnL >= 0 ? '+' : ''}{b.stats.netPnL.toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vídeo Aula */}
          <div>
            <p className="text-gray-400 text-xs mb-2 font-medium">Vídeo Aula</p>
            <button className="w-full bg-[#dc2626] hover:bg-[#b91c1c] rounded-xl px-3 py-3 flex items-center justify-center gap-2 transition-all">
              <Ico.Play /><Ico.Info />
            </button>
          </div>
        </div>

        {/* Gear + Play/Pause + Steps */}
        <div className="flex items-center gap-4">

          {/* Gear = criar/configurar */}
          <button onClick={() => setShowModal(true)} title="Criar novo bot"
            className="w-12 h-12 rounded-xl flex items-center justify-center border-2 border-[#2a3142] bg-[#1e2535] hover:bg-[#2a3142] hover:border-[#3b82f6] text-gray-400 hover:text-[#3b82f6] transition-all shrink-0">
            <Ico.Gear />
          </button>

          {/* Play / Pause / Resume */}
          <button
            onClick={handleToggle}
            disabled={!selectedBot || wsStatus !== 'connected'}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all shrink-0 ${
              !selectedBot || wsStatus !== 'connected'
                ? 'opacity-40 cursor-not-allowed border-gray-600 bg-transparent'
                : isRunning
                  ? 'border-[#dc2626] bg-transparent hover:bg-[#dc2626]/10'
                  : isPaused
                    ? 'border-[#f59e0b] bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20'
                    : 'border-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20'
            }`}
          >
            {isRunning
              ? <span className="text-[#dc2626]"><Ico.Pause /></span>
              : isPaused
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b"><path d="M6 4l14 8-14 8V4z"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e"><path d="M6 4l14 8-14 8V4z"/></svg>
            }
          </button>

          {/* Progress steps */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between mb-2">
              {steps.map((s, i) => (
                <span key={s} className={`text-[10px] sm:text-xs font-medium transition-colors ${i <= activeStep ? 'text-white' : 'text-gray-600'}`}>{s}</span>
              ))}
            </div>
            <div className="relative h-1 bg-[#2a3142] rounded-full">
              <div className="absolute h-full bg-[#3b82f6] rounded-full transition-all duration-500" style={{ width: `${animProgress}%` }} />
              {steps.map((_, i) => (
                <div key={i}
                  className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all ${i <= activeStep ? 'bg-white border-[#3b82f6] scale-110' : 'bg-[#1e2535] border-[#3a4255]'}`}
                  style={{ left: `calc(${(i / (steps.length - 1)) * 100}% - 7px)` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Stats inline — só quando bot activo */}
        {selectedBot && (isRunning || isPaused || selectedBot.status === 'error') && (
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-[#1e2535] border border-[#2a3142] text-xs">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusDot(selectedBot.status) }} />
            <span className="text-gray-300 font-medium truncate max-w-[100px]">{selectedBot.name}</span>
            <span className="text-gray-600">·</span>
            <span className="text-white font-mono">{selectedBot.stats.totalTrades} trades</span>
            <span className="text-[#22c55e] font-mono">{selectedBot.stats.wins}W</span>
            <span className="text-gray-600">/</span>
            <span className="text-[#ef4444] font-mono">{selectedBot.stats.losses}L</span>
            <span className={`font-bold font-mono ${selectedBot.stats.netPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {selectedBot.stats.netPnL >= 0 ? '+' : ''}{selectedBot.stats.netPnL.toFixed(2)} USD
            </span>
            {openCount > 0 && <span className="text-[#f59e0b] font-medium">{openCount} aberto{openCount !== 1 ? 's' : ''}</span>}
            {isPaused && (
              <button onClick={() => resumeBot(selectedBot.id)} className="ml-auto text-[#3b82f6] hover:text-white transition-colors font-semibold">
                Retomar →
              </button>
            )}
            {selectedBot.status === 'error' && (
              <span className="ml-auto text-[#ef4444] text-[10px]">Erro — verifica logs</span>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <BotModal
          onClose={() => setShowModal(false)}
          onCreate={createBot}
        />
      )}
    </>
  )
}
