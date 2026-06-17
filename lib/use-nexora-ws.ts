'use client'

// ============================================================
// NEXORA FOREX — WebSocket Hook
// Fluxo: utilizador lista catálogo → escolhe bot → configura
//        parâmetros → start_catalog_bot → backend executa
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  BotEvent, BotEventType, BotState, BotSummary,
  BotLogEntry, BotConfig, BotStrategyType,
  FrontendMsgType, BackendMsgType,
} from './nexora.types'

// ─── Tipo do catálogo (espelha CatalogBot do backend) ─────────
export interface CatalogBot {
  id:            string
  name:          string
  description:   string
  strategy:      BotStrategyType
  defaultConfig: BotConfig
  tags:          string[]
  createdAt:     string
  updatedAt:     string
  isActive:      boolean
}

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface NexoraWsCallbacks {
  // Catálogo de bots (disponíveis para o utilizador escolher)
  onCatalogLoaded?:    (bots: CatalogBot[]) => void
  // Bots da sessão do utilizador (em execução)
  onSessionBotsLoaded?: (bots: BotSummary[]) => void
  // Bot criado/iniciado a partir do catálogo
  onBotStarted?:       (bot: BotState & { catalogBotId?: string }) => void
  // Eventos do BotManager (started, stopped, paused, trade_opened, etc.)
  onBotEvent?:         (event: BotEvent) => void
  // Logs de um bot
  onBotLogs?:          (botId: string, logs: BotLogEntry[]) => void
  // Erros
  onError?:            (msg: string) => void
}

export function useNexoraWs(callbacks: NexoraWsCallbacks = {}) {
  const wsUrl      = process.env.NEXT_PUBLIC_WS_URL ?? 'wss://wss://banckend-nexora-production.up.railway.app'
  const wsRef      = useRef<WebSocket | null>(null)
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const mountedRef = useRef(true)
  const cbRef      = useRef(callbacks)
  cbRef.current    = callbacks

  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected')

  // ── Enviar mensagem ──────────────────────────────────────────
  // Formato: { type, payload } — o server.ts lê data.type e data.payload
  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  // ── Processar mensagem recebida do backend ────────────────────
  const handleMessage = useCallback((raw: string) => {
    let msg: { type?: string; payload?: unknown } = {}
    try {
      msg = JSON.parse(raw)
    } catch (e) {
      console.error('[NexoraWS] JSON inválido:', e, raw)
      return
    }

    if (!msg?.type) return

    const payload = msg.payload ?? {}

    try {
      switch (msg.type as string) {

        // ── Catálogo de bots (resposta a list_bots) ───────────
        case 'bots_list':
          cbRef.current.onCatalogLoaded?.(payload as CatalogBot[])
          break

        // ── Bots da sessão (resposta a list_session_bots) ─────
        case 'session_bots_list':
          cbRef.current.onSessionBotsLoaded?.(payload as BotSummary[])
          break

        // ── Bot criado e iniciado (resposta a start_catalog_bot)
        case 'bot_created':
          cbRef.current.onBotStarted?.(payload as BotState & { catalogBotId?: string })
          break

        // ── Confirmação de stop/pause/resume/delete ───────────
        // Tratadas via bot_event (bot:stopped, bot:paused, bot:resumed)
        // As confirmações explícitas abaixo são redundantes mas seguras
        case 'bot_stopped':
        case 'bot_paused':
        case 'bot_resumed':
        case 'bot_deleted':
          // O bots-context trata via onBotEvent; aqui apenas log de debug
          console.debug('[NexoraWS] confirmação:', msg.type, payload)
          break

        // ── Logs de um bot ────────────────────────────────────
        case 'bot_logs': {
          const p = payload as { botId?: string; logs?: BotLogEntry[] }
          if (p.botId && p.logs) cbRef.current.onBotLogs?.(p.botId, p.logs)
          break
        }

        // ── Eventos do BotManager (bot:started, bot:trade_closed, …)
        // O server.ts emite directamente o BotEventType como type
        // payload = { botId, ...rest }
        default:
          if ((msg.type as string).startsWith('bot:')) {
            const p = (payload ?? {}) as Record<string, unknown>
            cbRef.current.onBotEvent?.({
              type:    msg.type as BotEventType,
              botId:   typeof p.botId === 'string' ? p.botId : '',
              payload: p,
            })
            break
          }

          // ── Erro do servidor ──────────────────────────────
          if (msg.type === 'error') {
            const p = payload as Record<string, unknown>
            const errMsg = typeof p?.message === 'string' ? p.message
                         : typeof p?.error   === 'string' ? p.error
                         : typeof payload    === 'string' ? payload
                         : 'Erro desconhecido'
            cbRef.current.onError?.(errMsg as string)
            break
          }

          console.debug('[NexoraWS] mensagem não tratada:', msg.type, payload)
      }
    } catch (e) {
      console.error('[NexoraWS] erro ao processar mensagem:', msg.type, e)
    }
  }, [])

  // ── Conectar com backoff exponencial ─────────────────────────
  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setWsStatus('connecting')

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }
      attemptRef.current = 0
      setWsStatus('connected')
      // Pede catálogo de bots imediatamente após ligar
      ws.send(JSON.stringify({ type: 'list_bots', payload: {} }))
      // Keepalive 25s
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'ping', payload: {} }))
      }, 25_000)
    }

    ws.onmessage = (e) => handleMessage(e.data)

    ws.onerror = () => {
      if (!mountedRef.current) return
      setWsStatus('error')
      cbRef.current.onError?.('Erro de conexão WebSocket')
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setWsStatus('disconnected')
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      const delay = Math.min(1000 * 2 ** attemptRef.current, 30_000)
      attemptRef.current += 1
      reconnRef.current = setTimeout(connect, delay)
    }
  }, [wsUrl, handleMessage])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (pingRef.current)   clearInterval(pingRef.current)
      if (reconnRef.current) clearTimeout(reconnRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  // ── API pública ───────────────────────────────────────────────
  return {
    wsStatus,

    // Catálogo — o utilizador só lê e escolhe
    listCatalogBots:  useCallback(() => send('list_bots'),                    [send]),
    listSessionBots:  useCallback(() => send('list_session_bots'),            [send]),

    // Iniciar bot do catálogo com parâmetros do utilizador
    // catalogBotId: id do bot no catálogo
    // sessionName:  nome opcional para esta instância
    // configOverride: parâmetros que o utilizador pode ajustar
    startCatalogBot: useCallback((
      catalogBotId: string,
      sessionName?: string,
      configOverride?: Partial<BotConfig>,
    ) => send('start_catalog_bot', { catalogBotId, sessionName, configOverride: configOverride ?? {} }),
    [send]),

    // Controlo dos bots da sessão
    stopBot:    useCallback((botId: string) => send('stop_bot',    { botId }), [send]),
    pauseBot:   useCallback((botId: string) => send('pause_bot',   { botId }), [send]),
    resumeBot:  useCallback((botId: string) => send('resume_bot',  { botId }), [send]),
    deleteBot:  useCallback((botId: string) => send('delete_bot',  { botId }), [send]),
    getBotLogs: useCallback((botId: string, limit = 100) =>
                  send('get_bot_logs', { botId, limit }), [send]),

    // Admin — gerir catálogo via WS
    adminAddCatalogBot: useCallback((dto: {
      name: string;
      description: string;
      strategy: BotStrategyType;
      defaultConfig: BotConfig;
      tags?: string[];
      isActive?: boolean;
    }) => send('admin_add_catalog_bot', dto as Record<string, unknown>), [send]),

    adminRemoveCatalogBot: useCallback((id: string) =>
      send('admin_remove_catalog_bot', { id }), [send]),

    adminUpdateCatalogBot: useCallback((id: string, updates: Record<string, unknown>) =>
      send('admin_update_catalog_bot', { id, ...updates }), [send]),
  }
}
