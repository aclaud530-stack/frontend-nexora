'use client'

// ============================================================
// NEXORA FOREX — WebSocket Hook
//
// CORRECÇÕES:
//   ✅ handleMessage inclui 'send' nas dependências do useCallback
//   ✅ Handlers 'balance' e 'tick' adicionados para bridge com
//      TradingContext (via callbacks onBalance/onTick)
//   ✅ 'authenticated' tratado antes do default para não cair
//      no handler de bot events
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  BotEvent, BotEventType, BotState, BotSummary,
  BotLogEntry, BotConfig, BotStrategyType,
  FrontendMsgType, BackendMsgType,
} from './nexora.types'

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
  onCatalogLoaded?:     (bots: CatalogBot[]) => void
  onSessionBotsLoaded?: (bots: BotSummary[]) => void
  onBotStarted?:        (bot: BotState & { catalogBotId?: string }) => void
  onBotEvent?:          (event: BotEvent) => void
  onBotLogs?:           (botId: string, logs: BotLogEntry[]) => void
  onError?:             (msg: string) => void
  onAuthFailed?:        () => void
  // Bridge para TradingContext — dados de mercado do backend
  onBalance?:           (balance: number, currency: string) => void
  onTick?:              (quote: number) => void
  token?:               string | null
  accountId?:           string | null
}

export function useNexoraWs(callbacks: NexoraWsCallbacks = {}) {
  const wsUrl      = process.env.NEXT_PUBLIC_WS_URL ?? 'wss://banckend-nexora.onrender.com'
  const wsRef      = useRef<WebSocket | null>(null)
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const mountedRef = useRef(true)
  const cbRef      = useRef(callbacks)
  cbRef.current    = callbacks

  const tokenRef               = useRef(callbacks.token ?? null)
  const accountIdRef           = useRef(callbacks.accountId ?? null)
  const lastAuthSentRef        = useRef<string>('')
  const failedAuthKeyRef       = useRef<string>('')
  const lastMessageAtRef       = useRef<number>(Date.now())
  const watchdogRef            = useRef<ReturnType<typeof setInterval> | null>(null)
  tokenRef.current             = callbacks.token ?? null
  accountIdRef.current         = callbacks.accountId ?? null

  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected')

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  // CORRECÇÃO: send adicionado às dependências
  const handleMessage = useCallback((raw: string) => {
    let msg: { type?: string; payload?: unknown } = {}
    try { msg = JSON.parse(raw) } catch { return }
    if (!msg?.type) return

    const payload = msg.payload ?? {}

    try {
      switch (msg.type as string) {

        case 'bots_list':
          cbRef.current.onCatalogLoaded?.(payload as CatalogBot[])
          break

        case 'session_bots_list':
          cbRef.current.onSessionBotsLoaded?.(payload as BotSummary[])
          break

        case 'bot_created':
          cbRef.current.onBotStarted?.(payload as BotState & { catalogBotId?: string })
          break

        case 'bot_stopped':
        case 'bot_paused':
        case 'bot_resumed':
        case 'bot_deleted':
          break

        case 'bot_logs': {
          const p = payload as { botId?: string; logs?: BotLogEntry[] }
          if (p.botId && p.logs) cbRef.current.onBotLogs?.(p.botId, p.logs)
          break
        }

        // ── NOVO: dados de mercado do backend ────────────────
        // O server.ts emite 'balance' e 'tick' como proxy da Deriv.
        // Passamos para o TradingContext via bridge callbacks.
        case 'balance': {
          const p = payload as { balance?: number; currency?: string }
          if (p.balance != null) cbRef.current.onBalance?.(p.balance, p.currency ?? 'USD')
          break
        }

        case 'tick': {
          const p = payload as { quote?: number }
          if (p.quote != null) cbRef.current.onTick?.(p.quote)
          break
        }

        // ── CORRECÇÃO: authenticated tratado explicitamente ──
        // Evita cair no handler de bot:* ou no default sem tratamento
        case 'authenticated':
          // Pede catálogo e sessão após autenticação garantida
          send('list_bots')
          send('list_session_bots')
          break

        case 'deriv_disconnected':
        case 'deriv_reconnected':
          // Informativo — o backend trata reconexão automaticamente
          break

        case 'pong':
          // Resposta ao nosso ping — nada a fazer
          break

        case 'error': {
          const p = payload as Record<string, unknown>
          const rootMsg = (msg as Record<string, unknown>)
          const errMsg = typeof p?.message === 'string' ? p.message
                       : typeof p?.error   === 'string' ? p.error
                       : typeof payload    === 'string' ? payload
                       : typeof rootMsg?.message === 'string' ? rootMsg.message
                       : 'Erro desconhecido'
          const code = typeof p?.code === 'string' ? p.code
                     : typeof rootMsg?.code === 'string' ? rootMsg.code
                     : undefined
          if (code === 'AUTH_FAILED' || code === 'MISSING_TOKEN' || code === 'NO_ACCOUNTS' || code === 'OTP_FAILED') {
            failedAuthKeyRef.current = `${tokenRef.current}:${accountIdRef.current}`
            cbRef.current.onAuthFailed?.()
          }
          cbRef.current.onError?.(errMsg as string)
          break
        }

        default:
          if ((msg.type as string).startsWith('bot:')) {
            const nested = (payload ?? {}) as Record<string, unknown>
            const root   = (msg as Record<string, unknown>)
            const botId  = typeof nested.botId === 'string' ? nested.botId
                         : typeof root.botId   === 'string' ? root.botId : ''
            const evPayload = Object.keys(nested).length > 0 ? nested : root
            cbRef.current.onBotEvent?.({
              type:    msg.type as BotEventType,
              botId,
              payload: evPayload,
            })
          } else {
            console.debug('[NexoraWS] mensagem não tratada:', msg.type, payload)
          }
      }
    } catch (e) {
      console.error('[NexoraWS] erro ao processar mensagem:', msg.type, e)
    }
  }, [send]) // ← CORRECÇÃO: send nas deps

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
      ws.send(JSON.stringify({ type: 'list_bots', payload: {} }))
      if (tokenRef.current && accountIdRef.current) {
        const authKey = `${tokenRef.current}:${accountIdRef.current}`
        if (authKey !== failedAuthKeyRef.current) {
          lastAuthSentRef.current = authKey
          ws.send(JSON.stringify({ type: 'auth', payload: { token: tokenRef.current, accountId: accountIdRef.current } }))
        }
      }
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'ping', payload: {} }))
      }, 15_000)

      lastMessageAtRef.current = Date.now()
      if (watchdogRef.current) clearInterval(watchdogRef.current)
      watchdogRef.current = setInterval(() => {
        if (Date.now() - lastMessageAtRef.current > 40_000) {
          console.warn('[NexoraWS] Ligação sem resposta há 40s — a forçar reconexão')
          ws.close()
        }
      }, 10_000)
    }

    ws.onmessage = (e) => {
      lastMessageAtRef.current = Date.now()
      handleMessage(e.data)
    }

    ws.onerror = () => {
      if (!mountedRef.current) return
      setWsStatus('error')
      cbRef.current.onError?.('Erro de conexão WebSocket')
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setWsStatus('disconnected')
      if (pingRef.current)     { clearInterval(pingRef.current);     pingRef.current = null }
      if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null }
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
      if (pingRef.current)     clearInterval(pingRef.current)
      if (watchdogRef.current) clearInterval(watchdogRef.current)
      if (reconnRef.current)   clearTimeout(reconnRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const tryFastReconnect = () => {
      if (!mountedRef.current) return
      if (wsRef.current?.readyState === WebSocket.OPEN) return
      attemptRef.current = 0
      if (reconnRef.current) { clearTimeout(reconnRef.current); reconnRef.current = null }
      connect()
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') tryFastReconnect() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', tryFastReconnect)
    window.addEventListener('focus', tryFastReconnect)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', tryFastReconnect)
      window.removeEventListener('focus', tryFastReconnect)
    }
  }, [connect])

  useEffect(() => {
    const token     = callbacks.token ?? null
    const accountId = callbacks.accountId ?? null
    if (!token || !accountId) return
    const authKey = `${token}:${accountId}`
    if (lastAuthSentRef.current === authKey) return
    if (failedAuthKeyRef.current === authKey) return
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    lastAuthSentRef.current = authKey
    ws.send(JSON.stringify({ type: 'auth', payload: { token, accountId } }))
  }, [callbacks.token, callbacks.accountId])

  return {
    wsStatus,
    listCatalogBots:  useCallback(() => send('list_bots'),         [send]),
    listSessionBots:  useCallback(() => send('list_session_bots'), [send]),
    startCatalogBot:  useCallback((catalogBotId: string, sessionName?: string, configOverride?: Partial<BotConfig>) =>
                        send('start_catalog_bot', { catalogBotId, sessionName, configOverride: configOverride ?? {} }), [send]),
    stopBot:          useCallback((botId: string) => send('stop_bot',    { botId }), [send]),
    pauseBot:         useCallback((botId: string) => send('pause_bot',   { botId }), [send]),
    resumeBot:        useCallback((botId: string) => send('resume_bot',  { botId }), [send]),
    deleteBot:        useCallback((botId: string) => send('delete_bot',  { botId }), [send]),
    getBotLogs:       useCallback((botId: string, limit = 100) => send('get_bot_logs', { botId, limit }), [send]),
    adminAddCatalogBot: useCallback((dto: {
      name: string; description: string; strategy: BotStrategyType;
      defaultConfig: BotConfig; tags?: string[]; isActive?: boolean;
    }) => send('admin_add_catalog_bot', dto as Record<string, unknown>), [send]),
    adminRemoveCatalogBot: useCallback((id: string) => send('admin_remove_catalog_bot', { id }), [send]),
    adminUpdateCatalogBot: useCallback((id: string, updates: Record<string, unknown>) =>
      send('admin_update_catalog_bot', { id, ...updates }), [send]),
  }
}
