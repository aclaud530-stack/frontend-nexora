'use client'

// ============================================================
// NEXORA FOREX — Bots Context
// Reage a todos os BotEvents emitidos pelo BotManager Nexora
// ============================================================

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'
import {
  BotSummary, BotState, BotEvent, BotLogEntry,
  BotStats, BotConfig, BotStrategyType,
  TradeClosedPayload, TradeOpenedPayload,
} from './nexora.types'
import { useNexoraWs, WsStatus } from './use-nexora-ws'

// ─── TradeRecord para a UI ────────────────────────────────────
export interface TradeRecord {
  id:         string
  hora:       string
  botId:      string
  botName:    string
  strategy:   string
  stake:      number
  profit:     number
  won:        boolean
  timestamp:  number
  pending?:   boolean
  direction?: string
}

// ─── Contexto ─────────────────────────────────────────────────
interface BotsCtx {
  bots:          BotSummary[]
  botStates:     Record<string, BotState>
  wsStatus:      WsStatus
  isLoadingBots: boolean
  lastError:     string | null
  trades:        TradeRecord[]
  botTrades:     Record<string, TradeRecord[]>
  openTrades:    Record<string, TradeRecord>
  botLogs:       Record<string, BotLogEntry[]>
  listBots:   () => void
  createBot:  (name: string, strategy: BotStrategyType, config: BotConfig) => void
  startBot:   (botId: string) => void
  stopBot:    (botId: string) => void
  pauseBot:   (botId: string) => void
  resumeBot:  (botId: string) => void
  deleteBot:  (botId: string) => void
  getBotLogs: (botId: string, limit?: number) => void
  clearTrades: () => void
}

const Ctx = createContext<BotsCtx | null>(null)

export function useBots() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useBots must be used inside BotsProvider')
  return c
}

// ─── Provider ─────────────────────────────────────────────────
const MAX = 300

export function BotsProvider({ children }: { children: ReactNode }) {
  const [bots,          setBots]          = useState<BotSummary[]>([])
  const [botStates,     setBotStates]     = useState<Record<string, BotState>>({})
  const [trades,        setTrades]        = useState<TradeRecord[]>([])
  const [botTrades,     setBotTrades]     = useState<Record<string, TradeRecord[]>>({})
  const [openTrades,    setOpenTrades]    = useState<Record<string, TradeRecord>>({})
  const [botLogs,       setBotLogs]       = useState<Record<string, BotLogEntry[]>>({})
  const [isLoadingBots, setIsLoadingBots] = useState(true)
  const [lastError,     setLastError]     = useState<string | null>(null)

  // ref síncrona para lookup de nome/strategy por botId
  const botsRef = useRef<BotSummary[]>([])

  const getBotMeta = (botId: string) => {
    const b = botsRef.current.find(x => x.id === botId)
    return { name: b?.name ?? botId, strategy: b?.strategy ?? 'unknown' }
  }

  const patchBot = useCallback((botId: string, patch: Partial<BotSummary>) => {
    setBots(prev => {
      const next = prev.map(b => b.id === botId ? { ...b, ...patch } : b)
      botsRef.current = next
      return next
    })
  }, [])

  const showError = useCallback((msg: string) => {
    setLastError(msg)
    setTimeout(() => setLastError(null), 6000)
  }, [])

  // ── Handler de BotEvent — cobre todos os tipos do BaseStrategy ─
  const handleBotEvent = useCallback((ev: BotEvent) => {
    const { type, botId, payload } = ev

    switch (type) {

      case 'bot:started':
        patchBot(botId, { status: 'running', startedAt: new Date().toISOString() })
        break

      case 'bot:stopped':
        patchBot(botId, { status: 'stopped', stoppedAt: new Date().toISOString() })
        // limpa contratos abertos deste bot
        setOpenTrades(prev => {
          const n = { ...prev }
          Object.keys(n).forEach(k => { if (n[k].botId === botId) delete n[k] })
          return n
        })
        break

      case 'bot:paused':
        patchBot(botId, { status: 'paused' })
        break

      case 'bot:resumed':
        patchBot(botId, { status: 'running' })
        break

      case 'bot:error': {
        const msg = (payload as { error?: string }).error ?? 'Erro desconhecido'
        patchBot(botId, { status: 'error' })
        setBotStates(p => ({ ...p, [botId]: p[botId] ? { ...p[botId], lastError: msg, status: 'error' } : p[botId] }))
        showError(`Bot: ${msg}`)
        break
      }

      // BaseStrategy.recordTradeResult() → emite bot:stats_updated
      case 'bot:stats_updated': {
        const stats = (payload as { stats?: BotStats }).stats
        if (!stats) break
        patchBot(botId, { stats })
        setBotStates(p => ({ ...p, [botId]: p[botId] ? { ...p[botId], stats } : p[botId] }))
        break
      }

      // MartingaleStrategy → emite bot:trade_opened
      case 'bot:trade_opened': {
        const p = payload as unknown as TradeOpenedPayload
        if (!p?.contractId) break
        const { name, strategy } = getBotMeta(botId)
        const rec: TradeRecord = {
          id: p.contractId, hora: new Date().toLocaleTimeString('pt-PT'),
          botId, botName: name, strategy,
          stake: p.stake, profit: 0, won: false,
          timestamp: Date.now(), pending: true, direction: p.direction,
        }
        setOpenTrades(prev => ({ ...prev, [p.contractId]: rec }))
        break
      }

      // BaseStrategy.recordTradeResult() → emite bot:trade_closed
      // payload: { contractId, profit, won, stake }
      case 'bot:trade_closed': {
        const p = payload as unknown as TradeClosedPayload
        if (!p?.contractId) break
        const { name, strategy } = getBotMeta(botId)
        const rec: TradeRecord = {
          id: p.contractId, hora: new Date().toLocaleTimeString('pt-PT'),
          botId, botName: name, strategy,
          stake: p.stake, profit: p.profit, won: p.won,
          timestamp: Date.now(), pending: false,
        }
        setOpenTrades(prev => { const n = { ...prev }; delete n[p.contractId]; return n })
        setTrades(prev => [rec, ...prev].slice(0, MAX))
        setBotTrades(prev => ({ ...prev, [botId]: [rec, ...(prev[botId] ?? [])].slice(0, MAX) }))
        break
      }

      // BaseStrategy.log() → emite bot:log
      case 'bot:log': {
        const entry = (payload as { entry?: BotLogEntry }).entry
        if (!entry) break
        setBotLogs(prev => ({ ...prev, [botId]: [entry, ...(prev[botId] ?? [])].slice(0, 200) }))
        break
      }
    }
  }, [patchBot, showError])

  const handleBotsLoaded = useCallback((loaded: BotSummary[]) => {
    botsRef.current = loaded
    setBots(loaded)
    setIsLoadingBots(false)
  }, [])

  const handleBotCreated = useCallback((bot: BotState) => {
    const s: BotSummary = { id: bot.id, name: bot.name, strategy: bot.strategy, status: bot.status, stats: bot.stats }
    setBots(prev => { const n = [...prev, s]; botsRef.current = n; return n })
    setBotStates(prev => ({ ...prev, [bot.id]: bot }))
  }, [])

  const handleBotLogs = useCallback((botId: string, logs: BotLogEntry[]) => {
    setBotLogs(prev => ({ ...prev, [botId]: logs }))
  }, [])

  const ws = useNexoraWs({
    onBotsLoaded: handleBotsLoaded,
    onBotCreated: handleBotCreated,
    onBotEvent:   handleBotEvent,
    onBotLogs:    handleBotLogs,
    onError:      showError,
  })

  return (
    <Ctx.Provider value={{
      bots, botStates, wsStatus: ws.wsStatus, isLoadingBots, lastError,
      trades, botTrades, openTrades, botLogs,
      listBots:   ws.listBots,
      createBot:  ws.createBot,
      startBot:   ws.startBot,
      stopBot:    ws.stopBot,
      pauseBot:   ws.pauseBot,
      resumeBot:  ws.resumeBot,
      deleteBot:  ws.deleteBot,
      getBotLogs: ws.getBotLogs,
      clearTrades: useCallback(() => { setTrades([]); setBotTrades({}) }, []),
    }}>
      {children}
    </Ctx.Provider>
  )
}
