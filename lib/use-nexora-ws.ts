'use client'

// ============================================================
// NEXORA FOREX — WebSocket Hook
// Liga ao server.ts do Nexora e processa BotEvents do BotManager
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  BotEvent, BotEventType, BotState, BotSummary,
  BotLogEntry, BotConfig, BotStrategyType,
  FrontendMsgType, BackendMsgType,
} from './nexora.types'

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface NexoraWsCallbacks {
  onBotsLoaded?:   (bots: BotSummary[]) => void
  onBotCreated?:   (bot: BotState) => void
  onBotEvent?:     (event: BotEvent) => void
  onBotLogs?:      (botId: string, logs: BotLogEntry[]) => void
  onError?:        (msg: string) => void
}

export function useNexoraWs(callbacks: NexoraWsCallbacks = {}) {
  const wsUrl      = process.env.NEXT_PUBLIC_WS_URL ?? 'wss://banckend-production-14a1.up.railway.app'
  const wsRef      = useRef<WebSocket | null>(null)
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const mountedRef = useRef(true)
  const cbRef      = useRef(callbacks)
  cbRef.current    = callbacks

  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected')

  // ── Enviar mensagem ──────────────────────────────────────────
  const send = useCallback((type: FrontendMsgType, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  // ── Processar mensagem ───────────────────────────────────────
  const handleMessage = useCallback((raw: string) => {
    let msg: { type?: string; payload?: unknown } = {}
    try {
      msg = JSON.parse(raw)
    } catch (e) {
      console.error('[NexoraWS] JSON inválido:', e, raw)
      return
    }

    // Ignorar mensagens sem type (heartbeats, etc.)
    if (!msg?.type) return

    const payload = msg.payload ?? {}

    try {
      switch (msg.type as BackendMsgType) {
        case 'bots_list':
          cbRef.current.onBotsLoaded?.(payload as BotSummary[])
          break

        case 'bot_created':
          cbRef.current.onBotCreated?.(payload as BotState)
          break

        case 'bot_logs': {
          const p = payload as { botId?: string; logs?: BotLogEntry[] }
          if (p.botId && p.logs) cbRef.current.onBotLogs?.(p.botId, p.logs)
          break
        }

        // BotManager emite 'bot_event' com payload = BotEvent
        case 'bot_event':
          cbRef.current.onBotEvent?.(payload as BotEvent)
          break

        case 'error': {
          const p = payload as Record<string, unknown>
          const errMsg = typeof p?.message === 'string' ? p.message
                       : typeof p?.error   === 'string' ? p.error
                       : typeof payload    === 'string' ? payload
                       : 'Erro desconhecido'
          cbRef.current.onError?.(errMsg)
          break
        }

        case 'pong':
          break

        default:
          // Compatibilidade: server.ts pode emitir BotEventType directamente
          if ((msg.type as string).startsWith('bot:')) {
            const p = (payload ?? {}) as Record<string, unknown>
            cbRef.current.onBotEvent?.({
              type:    msg.type as BotEventType,
              botId:   typeof p.botId === 'string' ? p.botId : '',
              payload: p,
            })
          } else {
            console.debug('[NexoraWS] mensagem desconhecida:', msg.type, payload)
          }
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
      // Pede lista de bots imediatamente
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
    listBots:   useCallback(() => send('list_bots'),                                            [send]),
    createBot:  useCallback((name: string, strategy: BotStrategyType, config: BotConfig) =>
                  send('create_bot', { name, strategy, config }),                               [send]),
    startBot:   useCallback((botId: string) => send('start_bot',  { botId }),                  [send]),
    stopBot:    useCallback((botId: string) => send('stop_bot',   { botId }),                  [send]),
    pauseBot:   useCallback((botId: string) => send('pause_bot',  { botId }),                  [send]),
    resumeBot:  useCallback((botId: string) => send('resume_bot', { botId }),                  [send]),
    deleteBot:  useCallback((botId: string) => send('delete_bot', { botId }),                  [send]),
    getBotLogs: useCallback((botId: string, limit = 100) => send('get_bot_logs', { botId, limit }), [send]),
  }
}
