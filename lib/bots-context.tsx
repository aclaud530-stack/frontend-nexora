'use client'

// ============================================================
// NEXORA FOREX — Bots Context
// Fluxo correcto: Admin gere catálogo → Utilizador escolhe bot
//                 → configura parâmetros → executa na sessão
// ============================================================

import { createContext, useContext, useState, useCallback, useRef, useMemo, ReactNode } from 'react'
import {
  BotSummary, BotState, BotEvent, BotLogEntry,
  BotStats, BotConfig, BotStrategyType,
  TradeClosedPayload, TradeOpenedPayload,
} from './nexora.types'
import { useNexoraWs, WsStatus, CatalogBot } from './use-nexora-ws'
import { useAuth } from './auth-context'

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
  // Catálogo (bots disponíveis, geridos pelo admin)
  catalogBots:    CatalogBot[]
  isLoadingCatalog: boolean

  // Sessão do utilizador (bots em execução)
  sessionBots:    BotSummary[]
  botStates:      Record<string, BotState>

  // Estado geral
  wsStatus:       WsStatus
  lastError:      string | null

  // Histórico de trades
  trades:         TradeRecord[]
  botTrades:      Record<string, TradeRecord[]>
  openTrades:     Record<string, TradeRecord>
  botLogs:        Record<string, BotLogEntry[]>

  // Acções — Catálogo (só leitura para utilizadores)
  listCatalogBots: () => void
  listSessionBots: () => void

  // Iniciar bot do catálogo (utilizador escolhe e define parâmetros)
  startCatalogBot: (
    catalogBotId:   string,
    sessionName?:   string,
    configOverride?: Partial<BotConfig>,
  ) => void

  // Controlo dos bots da sessão
  stopBot:    (botId: string) => void
  pauseBot:   (botId: string) => void
  resumeBot:  (botId: string) => void
  deleteBot:  (botId: string) => void
  getBotLogs: (botId: string, limit?: number) => void
  clearTrades: () => void

  // Admin — gerir catálogo
  adminAddCatalogBot: (dto: {
    name: string;
    description: string;
    strategy: BotStrategyType;
    defaultConfig: BotConfig;
    tags?: string[];
    isActive?: boolean;
  }) => void
  adminRemoveCatalogBot: (id: string) => void
  adminUpdateCatalogBot: (id: string, updates: Record<string, unknown>) => void
}

const Ctx = createContext<BotsCtx | null>(null)

export function useBots() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useBots must be used inside BotsProvider')
  return c
}

// ─── Provider ─────────────────────────────────────────────────

const MAX_TRADES = 300

export function BotsProvider({ children }: { children: ReactNode }) {
  // Token/conta da sessão Deriv — necessários para autenticar esta
  // ligação WS no backend Nexora. Sem isto, o backend nunca marca a
  // sessão como autenticada e start_catalog_bot/stop_bot/etc. falham
  // sempre com "Not authenticated".
  // Mesmo padrão usado em TradingProviderWithAuth (providers.tsx):
  // espera isLoading terminar e usa fallback de localStorage para a conta.
  const { isLoading, currentAccount } = useAuth()
  const { token, accountId } = useMemo(() => {
    if (isLoading || typeof window === 'undefined') {
      return { token: null as string | null, accountId: null as string | null }
    }
    return {
      token:     localStorage.getItem('token') || null,
      accountId: currentAccount?.account_id || localStorage.getItem('currentAccountId') || null,
    }
  }, [isLoading, currentAccount?.account_id])

  // Catálogo (gerido pelo admin, só leitura para o utilizador)
  const [catalogBots,     setCatalogBots]     = useState<CatalogBot[]>([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)

  // Bots da sessão (instâncias em execução do utilizador)
  const [sessionBots,     setSessionBots]     = useState<BotSummary[]>([])
  const [botStates,       setBotStates]       = useState<Record<string, BotState>>({})

  // Trades e logs
  const [trades,          setTrades]          = useState<TradeRecord[]>([])
  const [botTrades,       setBotTrades]       = useState<Record<string, TradeRecord[]>>({})
  const [openTrades,      setOpenTrades]      = useState<Record<string, TradeRecord>>({})
  const [botLogs,         setBotLogs]         = useState<Record<string, BotLogEntry[]>>({})

  const [lastError,       setLastError]       = useState<string | null>(null)

  // Ref síncrona para lookup de nome/strategy por botId
  const sessionBotsRef = useRef<BotSummary[]>([])

  const getBotMeta = (botId: string) => {
    const b = sessionBotsRef.current.find(x => x.id === botId)
    return { name: b?.name ?? botId, strategy: b?.strategy ?? 'unknown' }
  }

  const patchSessionBot = useCallback((botId: string, patch: Partial<BotSummary>) => {
    setSessionBots(prev => {
      const next = prev.map(b => b.id === botId ? { ...b, ...patch } : b)
      sessionBotsRef.current = next
      return next
    })
  }, [])

  const showError = useCallback((msg: string) => {
    setLastError(msg)
    setTimeout(() => setLastError(null), 6000)
  }, [])

  // ── Catálogo carregado ────────────────────────────────────────
  const handleCatalogLoaded = useCallback((bots: CatalogBot[]) => {
    setCatalogBots(bots)
    setIsLoadingCatalog(false)
  }, [])

  // ── Bots da sessão carregados ─────────────────────────────────
  const handleSessionBotsLoaded = useCallback((bots: BotSummary[]) => {
    sessionBotsRef.current = bots
    setSessionBots(bots)
  }, [])

  // ── Bot iniciado a partir do catálogo ─────────────────────────
  const handleBotStarted = useCallback((bot: BotState & { catalogBotId?: string }) => {
    const summary: BotSummary = {
      id: bot.id, name: bot.name, strategy: bot.strategy,
      status: bot.status, stats: bot.stats,
      startedAt: bot.startedAt, stoppedAt: bot.stoppedAt,
    }
    setSessionBots(prev => {
      const next = [...prev, summary]
      sessionBotsRef.current = next
      return next
    })
    setBotStates(prev => ({ ...prev, [bot.id]: bot }))
  }, [])

  // ── Logs recebidos ────────────────────────────────────────────
  const handleBotLogs = useCallback((botId: string, logs: BotLogEntry[]) => {
    setBotLogs(prev => ({ ...prev, [botId]: logs }))
  }, [])

  // ── Eventos do BotManager ─────────────────────────────────────
  const handleBotEvent = useCallback((ev: BotEvent) => {
    const { type, botId, payload } = ev

    switch (type) {

      case 'bot:started':
        patchSessionBot(botId, { status: 'running', startedAt: new Date().toISOString() as any })
        break

      case 'bot:stopped':
        patchSessionBot(botId, { status: 'stopped', stoppedAt: new Date().toISOString() as any })
        setOpenTrades(prev => {
          const n = { ...prev }
          Object.keys(n).forEach(k => { if (n[k].botId === botId) delete n[k] })
          return n
        })
        break

      case 'bot:paused':
        patchSessionBot(botId, { status: 'paused' })
        break

      case 'bot:resumed':
        patchSessionBot(botId, { status: 'running' })
        break

      case 'bot:error': {
        const msg = (payload as { error?: string }).error ?? 'Erro desconhecido'
        patchSessionBot(botId, { status: 'error' })
        setBotStates(p => ({
          ...p,
          [botId]: p[botId] ? { ...p[botId], lastError: msg, status: 'error' } : p[botId],
        }))
        showError(`Bot: ${msg}`)
        break
      }

      case 'bot:stats_updated': {
        const stats = (payload as { stats?: BotStats }).stats
        if (!stats) break
        patchSessionBot(botId, { stats })
        setBotStates(p => ({
          ...p,
          [botId]: p[botId] ? { ...p[botId], stats } : p[botId],
        }))
        break
      }

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
        setTrades(prev => [rec, ...prev].slice(0, MAX_TRADES))
        setBotTrades(prev => ({
          ...prev,
          [botId]: [rec, ...(prev[botId] ?? [])].slice(0, MAX_TRADES),
        }))
        break
      }

      case 'bot:log': {
        const entry = (payload as { entry?: BotLogEntry }).entry
        if (!entry) break
        setBotLogs(prev => ({
          ...prev,
          [botId]: [entry, ...(prev[botId] ?? [])].slice(0, 200),
        }))
        break
      }
    }
  }, [patchSessionBot, showError])

  const ws = useNexoraWs({
    onCatalogLoaded:     handleCatalogLoaded,
    onSessionBotsLoaded: handleSessionBotsLoaded,
    onBotStarted:        handleBotStarted,
    onBotEvent:          handleBotEvent,
    onBotLogs:           handleBotLogs,
    onError:             showError,
    token,
    accountId,
  })

  const clearTrades = useCallback(() => {
    setTrades([])
    setBotTrades({})
  }, [])

  return (
    <Ctx.Provider value={{
      // Catálogo
      catalogBots,
      isLoadingCatalog,

      // Sessão
      sessionBots,
      botStates,

      // Estado
      wsStatus: ws.wsStatus,
      lastError,

      // Trades / logs
      trades,
      botTrades,
      openTrades,
      botLogs,

      // Acções — catálogo
      listCatalogBots: ws.listCatalogBots,
      listSessionBots: ws.listSessionBots,
      startCatalogBot: ws.startCatalogBot,

      // Acções — controlo de sessão
      stopBot:    ws.stopBot,
      pauseBot:   ws.pauseBot,
      resumeBot:  ws.resumeBot,
      deleteBot:  ws.deleteBot,
      getBotLogs: ws.getBotLogs,
      clearTrades,

      // Admin
      adminAddCatalogBot:    ws.adminAddCatalogBot,
      adminRemoveCatalogBot: ws.adminRemoveCatalogBot,
      adminUpdateCatalogBot: ws.adminUpdateCatalogBot,
    }}>
      {children}
    </Ctx.Provider>
  )
}
