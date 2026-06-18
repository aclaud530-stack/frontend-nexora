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
  // Token OAuth da Deriv (de useAuth/localStorage) e conta activa —
  // necessários para autenticar a sessão no backend Nexora. Sem isto,
  // o backend nunca chama session.authenticated = true e qualquer
  // acção de bot falha com "Not authenticated".
  token?:              string | null
  accountId?:          string | null
}

export function useNexoraWs(callbacks: NexoraWsCallbacks = {}) {
  const wsUrl      = process.env.NEXT_PUBLIC_WS_URL ?? 'wss://banckend-nexora-production.up.railway.app'
  const wsRef      = useRef<WebSocket | null>(null)
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const mountedRef = useRef(true)
  const cbRef      = useRef(callbacks)
  cbRef.current    = callbacks

  // Refs para token/accountId — sempre actualizadas, evitam reabrir
  // a ligação WS a cada render quando estes valores mudam.
  const tokenRef     = useRef(callbacks.token ?? null)
  const accountIdRef = useRef(callbacks.accountId ?? null)
  const lastAuthSentRef = useRef<string>('')
  tokenRef.current     = callbacks.token ?? null
  accountIdRef.current = callbacks.accountId ?? null

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
        // O server.ts emite o BotEventType como type, com
        // payload = { botId, ...rest } aninhado em msg.payload.
        default:
          if ((msg.type as string).startsWith('bot:')) {
            const nested = (payload ?? {}) as Record<string, unknown>
            const root   = (msg as Record<string, unknown>)
            // Tolerante a ambos os formatos: aninhado em payload (formato
            // atual do backend) ou na raiz da mensagem (defensivo).
            const botId = typeof nested.botId === 'string' ? nested.botId
                        : typeof root.botId   === 'string' ? root.botId
                        : ''
            const evPayload = Object.keys(nested).length > 0 ? nested : root
            cbRef.current.onBotEvent?.({
              type:    msg.type as BotEventType,
              botId,
              payload: evPayload,
            })
            break
          }

          // ── Erro do servidor ──────────────────────────────
          if (msg.type === 'error') {
            const p = payload as Record<string, unknown>
            const rootMsg = (msg as Record<string, unknown>)
            const errMsg = typeof p?.message === 'string' ? p.message
                         : typeof p?.error   === 'string' ? p.error
                         : typeof payload    === 'string' ? payload
                         // tolerância extra: caso o backend envie code/message
                         // na raiz da mensagem em vez de aninhados em payload
                         : typeof rootMsg?.message === 'string' ? rootMsg.message
                         : typeof rootMsg?.error   === 'string' ? rootMsg.error
                         : 'Erro desconhecido'
            cbRef.current.onError?.(errMsg as string)
            break
          }


          // ── Confirmação de autenticação ───────────────────
          // Sempre que a sessão fica autenticada, pedimos o catálogo
          // outra vez como rede de segurança — cobre o caso em que o
          // list_bots inicial (enviado no onopen, antes do auth) tenha
          // chegado a uma instância/sessão ainda não autenticada.
          if (msg.type === 'authenticated') {
            send('list_bots')
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
      // Pede catálogo de bots imediatamente após ligar.
      // list_bots é público no backend (não exige autenticação),
      // por isso pode ser pedido logo aqui em segurança.
      ws.send(JSON.stringify({ type: 'list_bots', payload: {} }))
      // Se já temos token/conta (ex: utilizador já tinha sessão Deriv
      // activa antes desta ligação WS abrir), autentica imediatamente.
      // Sem isto, qualquer acção de bot falha com "Not authenticated".
      if (tokenRef.current && accountIdRef.current) {
        const authKey = `${tokenRef.current}:${accountIdRef.current}`
        lastAuthSentRef.current = authKey
        ws.send(JSON.stringify({
          type: 'auth',
          payload: { token: tokenRef.current, accountId: accountIdRef.current },
        }))
      }
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

  // ── (Re)autenticar quando token/accountId chegam ou mudam ────
  // Cobre dois casos que o onopen por si só não cobre:
  //   1) login termina DEPOIS da ligação WS já estar aberta
  //   2) utilizador troca de conta (accountId muda) com o socket já ligado
  // Sem isto, a sessão fica para sempre "Not authenticated" se o
  // token só chegar depois do socket abrir.
  useEffect(() => {
    const token     = callbacks.token ?? null
    const accountId = callbacks.accountId ?? null
    if (!token || !accountId) return

    const authKey = `${token}:${accountId}`
    if (lastAuthSentRef.current === authKey) return // já autenticado com estas credenciais

    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return // o onopen trata deste caso

    lastAuthSentRef.current = authKey
    ws.send(JSON.stringify({ type: 'auth', payload: { token, accountId } }))
  }, [callbacks.token, callbacks.accountId])

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
