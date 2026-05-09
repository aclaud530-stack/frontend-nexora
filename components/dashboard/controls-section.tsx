'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useTrading } from '@/lib/trading-context'
import { useBots } from '@/lib/bots-context'
import {
  BotSummary, BotConfig,
  COMMON_CONFIG_FIELDS, STRATEGY_PARAMS_FIELDS, STRATEGY_LABELS, StrategyFieldDef,
} from '@/lib/nexora.types'
import { useLoader } from '@/components/loader'

// ─── Icons ────────────────────────────────────────────────────
const Ico = {
  Refresh: ({ spin }: { spin?: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={spin ? 'animate-spin' : ''}>
      <path d="M1 4v5h5" /><path d="M15 12V7h-5" />
      <path d="M13.51 5.87a6 6 0 0 0-10.16 2.14" /><path d="M2.49 10.13a6 6 0 0 0 10.16-2.14" />
    </svg>
  ),
  Play: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  ),
  Info: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7" /><line x1="8" y1="11" x2="8" y2="7" /><line x1="8" y1="5" x2="8.01" y2="5" />
    </svg>
  ),
  Pause: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="8" y1="5" x2="8" y2="19" /><line x1="16" y1="5" x2="16" y2="19" />
    </svg>
  ),
  Gear: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
}

// ─── WS dot ───────────────────────────────────────────────────
function WsDot({ status }: { status: string }) {
  const c = status === 'connected' ? '#22c55e' : status === 'connecting' ? '#f59e0b' : '#ef4444'
  return (
    <span className="w-2 h-2 rounded-full shrink-0 transition-colors"
      style={{ background: c, boxShadow: status === 'connected' ? `0 0 5px ${c}88` : 'none' }}
      title={`WebSocket: ${status}`}
    />
  )
}

// ─── Campo genérico ───────────────────────────────────────────
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
        className="w-full bg-[#0f1623] border border-[#2a3142] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6] appearance-none cursor-pointer">
        {f.options?.map(o => <option key={o.value} value={o.value} className="bg-[#0f1623]">{o.label}</option>)}
      </select>
    )
  }
  return (
    <input type="number" value={value as number} min={f.min} max={f.max} step={f.step ?? 1}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full bg-[#0f1623] border border-[#2a3142] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3b82f6]" />
  )
}

// ─── Modal de parâmetros ──────────────────────────────────────
function ConfigModal({ bot, onClose, onConfirm }: {
  bot: BotSummary
  onClose: () => void
  onConfirm: (config: BotConfig) => void
}) {
  const [cfgVals, setCfgVals] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {}
    COMMON_CONFIG_FIELDS.forEach(f => { v[f.key] = f.defaultValue })
    return v
  })
  const [prmVals, setPrmVals] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {}
    ;(STRATEGY_PARAMS_FIELDS[bot.strategy] ?? []).forEach(f => { v[f.key] = f.defaultValue })
    return v
  })

  const configGroups = useMemo(() => {
    const g: Record<string, StrategyFieldDef[]> = {}
    COMMON_CONFIG_FIELDS.forEach(f => {
      const k = f.group ?? 'Geral'
      if (!g[k]) g[k] = []
      g[k].push(f)
    })
    return g
  }, [])

  const strategyFields = STRATEGY_PARAMS_FIELDS[bot.strategy] ?? []

  const handleConfirm = () => {
    const config: BotConfig = {
      symbol:         cfgVals.symbol as string,
      contractType:   cfgVals.contractType as string,
      duration:       cfgVals.duration as number,
      durationUnit:   cfgVals.durationUnit as BotConfig['durationUnit'],
      initialStake:   cfgVals.initialStake as number,
      currency:       'USD',
      maxTrades:      cfgVals.maxTrades as number,
      maxLoss:        cfgVals.maxLoss as number,
      maxProfit:      cfgVals.maxProfit as number,
      strategyParams: prmVals,
    }
    onConfirm(config)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-4 z-50 max-w-lg mx-auto">
        <div className="bg-[#111827] border border-[#1f2a3c] rounded-2xl shadow-2xl overflow-hidden">

          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2a3c]">
            <div>
              <p className="text-white font-semibold text-sm">{bot.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{STRATEGY_LABELS[bot.strategy]}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#1f2a3c] hover:bg-[#2a3650] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <Ico.Close />
            </button>
          </div>

          <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">

            {Object.entries(configGroups).map(([group, fields]) => (
              <div key={group}>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3">{group}</p>
                <div className="space-y-3">
                  {fields.map(f => (
                    <div key={f.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-gray-300 text-xs font-medium">{f.label}</label>
                        {f.type === 'toggle' && (
                          <Field f={f} value={cfgVals[f.key]} onChange={v => setCfgVals(p => ({ ...p, [f.key]: v }))} />
                        )}
                      </div>
                      {f.type !== 'toggle' && (
                        <Field f={f} value={cfgVals[f.key]} onChange={v => setCfgVals(p => ({ ...p, [f.key]: v }))} />
                      )}
                      {f.description && <p className="text-gray-600 text-[10px] mt-1">{f.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {strategyFields.length > 0 && (
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3">Parâmetros da Estratégia</p>
                <div className="space-y-3">
                  {strategyFields.map(f => (
                    <div key={f.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <label className="text-gray-300 text-xs font-medium">{f.label}</label>
                          {f.description && <p className="text-gray-600 text-[10px]">{f.description}</p>}
                        </div>
                        {f.type === 'toggle' && (
                          <Field f={f} value={prmVals[f.key]} onChange={v => setPrmVals(p => ({ ...p, [f.key]: v }))} />
                        )}
                      </div>
                      {f.type !== 'toggle' && (
                        <Field f={f} value={prmVals[f.key]} onChange={v => setPrmVals(p => ({ ...p, [f.key]: v }))} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-[#1f2a3c] flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2.5 bg-[#1f2a3c] hover:bg-[#2a3650] text-gray-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleConfirm}
              className="flex-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
              Confirmar
            </button>
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
  const {
    catalogBots, sessionBots,
    wsStatus, isLoadingCatalog, lastError,
    startBot, stopBot, resumeBot, listCatalog,
  } = useBots()
  const loader = useLoader()

  const [showAccDrop,   setShowAccDrop]   = useState(false)
  const [showBotDrop,   setShowBotDrop]   = useState(false)
  const [showConfig,    setShowConfig]    = useState(false)
  const [selectedBot,   setSelectedBot]   = useState<BotSummary | null>(null)
  const [pendingConfig, setPendingConfig] = useState<BotConfig | null>(null)
  const [animProgress,  setAnimProgress]  = useState(0)

  // Seleccionar primeiro bot automaticamente
  useEffect(() => {
    if (!selectedBot && catalogBots.length > 0) setSelectedBot(catalogBots[0])
  }, [catalogBots])

  // Status live (sessão)
  const liveBot  = selectedBot ? sessionBots.find(b => b.id === selectedBot.id) : null
  const isRunning = liveBot?.status === 'running'
  const isPaused  = liveBot?.status === 'paused'

  // Barra de progresso — apenas os 3 passos reais
  const stepMap: Record<string, number> = { idle: -1, analyzing: 0, contract_open: 1, contract_closed: 2 }
  const activeStep = stepMap[botStatus?.currentStep ?? 'idle'] ?? -1
  const steps = ['Analisando', 'Contrato aberto', 'Contrato fechado']

  useEffect(() => {
    const target = isRunning && activeStep >= 0 ? ((activeStep + 1) / steps.length) * 100 : 0
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
    else               startBot(selectedBot.id, pendingConfig ?? undefined)
  }

  const handleAccSelect = async (acc: typeof accounts[number]) => {
    setShowAccDrop(false)
    if (currentAccount?.account_id === acc.account_id) return
    const label = acc.is_virtual ? 'Conta Demo' : 'Conta Real'
    loader.show(`A ligar a ${label}…`)
    try { await setCurrentAccount(acc); loader.complete(`${label} activa!`) }
    catch { loader.hide() }
  }

  const accLabel = !currentAccount ? 'Selecionar' : currentAccount.is_virtual ? 'Demo' : 'Real'
  const accColor = !currentAccount ? '#6b7280' : currentAccount.is_virtual ? '#2ec7ff' : '#22c55e'

  return (
    <>
      <div className="space-y-4">

        {/* Erro */}
        {lastError && (
          <div className="px-3 py-2 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-xs">
            ⚠ {lastError}
          </div>
        )}

        {/* Grid 3 colunas */}
        <div className="grid grid-cols-3 gap-3">

          {/* Conta */}
          <div className="relative">
            <p className="text-gray-400 text-xs mb-2 font-medium">Tipo de Conta</p>
            <button onClick={() => setShowAccDrop(!showAccDrop)}
              className="w-full bg-[#1e2535] hover:bg-[#242f45] rounded-xl px-3 py-3 flex items-center justify-center gap-2 border border-[#2a3142] transition-all">
              <span className="text-sm font-semibold" style={{ color: accColor }}>{accLabel}</span>
              <Ico.Refresh />
            </button>
            {showAccDrop && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#111827] rounded-xl shadow-xl border border-[#1f2a3c] py-1 z-50">
                {accounts.map(a => (
                  <button key={a.account_id} onClick={() => handleAccSelect(a)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#1f2a3c] transition-colors ${currentAccount?.account_id === a.account_id ? 'text-[#22c55e]' : 'text-white'}`}>
                    {a.is_virtual ? 'Conta Demo' : 'Conta Real'}
                    <span className="text-gray-500 text-xs"> — ${Number(a.balance ?? 0).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Estratégia — catálogo do backend */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-xs font-medium">Estratégia</p>
              <div className="flex items-center gap-2">
                <WsDot status={wsStatus} />
                <button onClick={listCatalog} title="Recarregar" className="text-gray-500 hover:text-gray-300 transition-colors">
                  <Ico.Refresh spin={isLoadingCatalog} />
                </button>
              </div>
            </div>
            <button onClick={() => setShowBotDrop(!showBotDrop)}
              className="w-full bg-[#1e2535] hover:bg-[#242f45] rounded-xl px-3 py-3 flex items-center gap-2 border border-[#2a3142] transition-all min-w-0">
              {selectedBot ? (
                <>
                  <span className="text-white font-semibold text-sm truncate">{selectedBot.name}</span>
                  <span className="text-gray-500 text-[10px] ml-auto shrink-0 hidden sm:block">
                    {STRATEGY_LABELS[selectedBot.strategy]}
                  </span>
                </>
              ) : (
                <span className="text-gray-500 text-sm">{isLoadingCatalog ? 'A carregar…' : 'Selecionar'}</span>
              )}
            </button>

            {showBotDrop && catalogBots.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#111827] rounded-xl shadow-xl border border-[#1f2a3c] py-1 z-50 max-h-56 overflow-y-auto">
                {catalogBots.map(b => (
                  <button key={b.id}
                    onClick={() => { setSelectedBot(b); setPendingConfig(null); setShowBotDrop(false) }}
                    className={`w-full px-4 py-2.5 text-left hover:bg-[#1f2a3c] transition-colors ${selectedBot?.id === b.id ? 'bg-[#1f2a3c]' : ''}`}>
                    <p className="text-sm text-white font-medium truncate">{b.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{STRATEGY_LABELS[b.strategy]}</p>
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

        {/* Engrenagem + Play + Progresso */}
        <div className="flex items-center gap-4">

          {/* Engrenagem */}
          <button
            onClick={() => selectedBot && setShowConfig(true)}
            disabled={!selectedBot}
            title="Configurar parâmetros"
            className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed
              ${pendingConfig
                ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]'
                : 'border-[#2a3142] bg-[#1e2535] text-gray-400 hover:border-[#3b82f6] hover:text-[#3b82f6] hover:bg-[#242f45]'
              }`}>
            <Ico.Gear />
          </button>

          {/* Play / Pause */}
          <button
            onClick={handleToggle}
            disabled={!selectedBot || wsStatus !== 'connected'}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all shrink-0 ${
              !selectedBot || wsStatus !== 'connected'
                ? 'opacity-40 cursor-not-allowed border-gray-700 bg-transparent'
                : isRunning
                  ? 'border-[#dc2626] bg-transparent hover:bg-[#dc2626]/10'
                  : isPaused
                    ? 'border-[#f59e0b] bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20'
                    : 'border-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20'
            }`}>
            {isRunning
              ? <span className="text-[#dc2626]"><Ico.Pause /></span>
              : isPaused
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b"><path d="M6 4l14 8-14 8V4z" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e"><path d="M6 4l14 8-14 8V4z" /></svg>
            }
          </button>

          {/* Barra — 3 passos do processo */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between mb-2">
              {steps.map((s, i) => (
                <span key={s} className={`text-[10px] sm:text-xs font-medium transition-colors ${i <= activeStep ? 'text-white' : 'text-gray-600'}`}>
                  {s}
                </span>
              ))}
            </div>
            <div className="relative h-1 bg-[#2a3142] rounded-full">
              <div className="absolute h-full bg-[#3b82f6] rounded-full transition-all duration-500"
                style={{ width: `${animProgress}%` }} />
              {steps.map((_, i) => (
                <div key={i}
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-all ${
                    i <= activeStep ? 'bg-white border-[#3b82f6] scale-110' : 'bg-[#1e2535] border-[#3a4255]'
                  }`}
                  style={{ left: `calc(${(i / (steps.length - 1)) * 100}% - 6px)` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {showConfig && selectedBot && (
        <ConfigModal
          bot={selectedBot}
          onClose={() => setShowConfig(false)}
          onConfirm={setPendingConfig}
        />
      )}
    </>
  )
}
