'use client'

/**
 * trading-context.tsx
 *
 * WebSocket robusto com:
 * - Autenticação via OTP (REST → WebSocket URL autenticado)
 * - Reconexão exponencial com jitter
 * - Heartbeat / ping-pong para detetar conexões mortas
 * - Fila de mensagens offline — enviadas após reconexão
 * - Dados do gráfico de barras calculados sem bloquear o render thread
 * - Método de desconexão explícito para logout
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface BarEntry {
  digit:       number
  percentage:  number
  isHighlight: boolean
  isLow:       boolean
}

export interface Trade {
  id:        string
  hora:      string
  tipo:      string
  tickFinal: number
  preco:     string
  resultado: number
}

export interface Strategy {
  id:   string
  name: string
}

export interface BotStatus {
  isRunning:   boolean
  currentStep: 'idle' | 'analyzing' | 'contract_open' | 'contract_closed'
}

export interface ChartData {
  barData:    BarEntry[]
  lastDigit:  number
}

interface TradingContextValue {
  balance:      number
  profit:       number
  wins:         number
  losses:       number
  currency:     string
  lastDigit:    number
  chartData:    ChartData | null
  isConnected:  boolean
  loading:      boolean

  selectedTicks:    number
  setSelectedTicks: (t: number) => void

  trades:          Trade[]
  clearTrades:     () => Promise<void>
  isLoadingTrades: boolean

  strategies:          Strategy[]
  currentStrategy:     Strategy | null
  setCurrentStrategy:  (s: Strategy) => void
  botStatus:           BotStatus
  startBot:            () => Promise<void>
  stopBot:             () => Promise<void>

  /** Desconecta o WebSocket — usado no logout */
  disconnect:     () => void
}

const TradingContext = createContext<TradingContextValue | undefined>(undefined)

// ── Constantes ────────────────────────────────────────────────────────────────

const REST_BASE_URL      = process.env.NEXT_PUBLIC_DERIV_REST_URL || 'https://api.derivws.com'
const APP_ID             = process.env.NEXT_PUBLIC_DERIV_APP_ID   || ''
const WS_PUBLIC_URL      = 'wss://api.derivws.com/trading/v1/options/ws/public'
const SYMBOL             = '1HZ100V'

const RECONNECT_BASE_MS  = 1_000
const RECONNECT_MAX_MS   = 30_000
const HEARTBEAT_INTERVAL = 20_000
const HEARTBEAT_TIMEOUT  = 10_000
const MAX_DIGIT_HISTORY  = 1_000

// ── Utilitários ───────────────────────────────────────────────────────────────

function jitter(ms: number) {
  return ms + Math.random() * ms * 0.3
}

function computeBarData(digits: number[], windowSize: number): BarEntry[] {
  const slice  = digits.slice(-windowSize)
  const counts = Array(10).fill(0)
  slice.forEach(d => counts[d]++)
  const total  = slice.length || 1
  const pcts   = counts.map(c => (c / total) * 100)
  const max    = Math.max(...pcts)
  const min    = Math.min(...pcts)
  return pcts.map((pct, digit) => ({
    digit,
    percentage:  pct,
    isHighlight: pct === max,
    isLow:       pct === min,
  }))
}

// ── Obter URL WebSocket autenticado via OTP ───────────────────────────────────

async function fetchOtpWsUrl(
  accountId: string,
  oauthToken: string,
): Promise<string> {
  const res = await fetch(
    `${REST_BASE_URL}/trading/v1/options/accounts/${accountId}/otp`,
    {
      method: 'POST',
      headers: {
        'Deriv-App-ID':  APP_ID,
        'Authorization': `Bearer ${oauthToken}`,
      },
    },
  )

  if (!res.ok) {
    throw new Error(`OTP request failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json() as { data: { url: string } }
  return json.data.url
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function TradingProvider({ children }: { children: ReactNode }) {
  // ── estado público ──────────────────────────────────────────────────────────
  const [balance,       setBalance]       = useState(0)
  const [profit,        setProfit]        = useState(0)
  const [wins,          setWins]          = useState(0)
  const [losses,        setLosses]        = useState(0)
  const [currency,      setCurrency]      = useState('USD')
  const [lastDigit,     setLastDigit]     = useState<number>(0)
  const [chartData,     setChartData]     = useState<ChartData | null>(null)
  const [isConnected,   setIsConnected]   = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [selectedTicks, setSelectedTicks] = useState(100)
  const [trades,        setTrades]        = useState<Trade[]>([])
  const [isLoadingTrades] = useState(false)
  const [strategies]    = useState<Strategy[]>([
    { id: 'digit_diff',  name: 'Digit Differ' },
    { id: 'digit_match', name: 'Digit Match'  },
    { id: 'over_under',  name: 'Over/Under'   },
    { id: 'even_odd',    name: 'Even/Odd'     },
  ])
  const [currentStrategy, setCurrentStrategy] = useState<Strategy | null>(strategies[0])
  const [botStatus, setBotStatus] = useState<BotStatus>({ isRunning: false, currentStep: 'idle' })

  // ── refs internos ───────────────────────────────────────────────────────────
  const wsRef             = useRef<WebSocket | null>(null)
  const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer    = useRef<ReturnType<typeof setInterval> | null>(null)
  const pongTimer         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount        = useRef(0)
  const messageQueue      = useRef<string[]>([])
  const digitHistory      = useRef<number[]>([])
  const selectedTicksRef  = useRef(selectedTicks)
  const mountedRef        = useRef(true)
  const pendingProposalId = useRef<string | null>(null)

  useEffect(() => {
    selectedTicksRef.current = selectedTicks
  }, [selectedTicks])

  // ── Flush da fila de mensagens ──────────────────────────────────────────────
  const flushQueue = useCallback((ws: WebSocket) => {
    while (messageQueue.current.length > 0) {
      const msg = messageQueue.current.shift()!
      if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
  }, [])

  // ── Enviar mensagem (com fila offline) ─────────────────────────────────────
  const send = useCallback((payload: object) => {
    const msg = JSON.stringify(payload)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(msg)
    } else {
      messageQueue.current.push(msg)
    }
  }, [])

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  const startHeartbeat = useCallback((ws: WebSocket) => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)

    heartbeatTimer.current = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return

      ws.send(JSON.stringify({ ping: 1 }))

      pongTimer.current = setTimeout(() => {
        console.warn('[WS] Pong timeout — forçando reconexão')
        ws.close(4000, 'heartbeat timeout')
      }, HEARTBEAT_TIMEOUT)
    }, HEARTBEAT_INTERVAL)
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
    if (pongTimer.current)      clearTimeout(pongTimer.current)
  }, [])

  // ── Processar mensagem do WebSocket ────────────────────────────────────────
  const handleMessage = useCallback((raw: string) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(raw) } catch { return }

    if (msg.msg_type === 'ping') {
      if (pongTimer.current) clearTimeout(pongTimer.current)
      return
    }

    if (msg.msg_type === 'tick' && msg.tick) {
      const tick  = msg.tick as { quote: number; epoch: number }
      const price = tick.quote

      const priceStr = price.toFixed(2)
      const digit    = parseInt(priceStr[priceStr.length - 1], 10)

      digitHistory.current.push(digit)
      if (digitHistory.current.length > MAX_DIGIT_HISTORY)
        digitHistory.current = digitHistory.current.slice(-MAX_DIGIT_HISTORY)

      if (!mountedRef.current) return

      setLastDigit(digit)
      setLoading(false)

      const w = selectedTicksRef.current
      queueMicrotask(() => {
        if (!mountedRef.current) return
        const barData = computeBarData(digitHistory.current, w)
        setChartData({ barData, lastDigit: digit })
      })
    }

    if (msg.msg_type === 'history' && msg.history) {
      const h = msg.history as { prices: number[]; times: number[] }
      h.prices.forEach((price) => {
        const s = price.toFixed(2)
        digitHistory.current.push(parseInt(s[s.length - 1], 10))
      })
    }

    if (msg.msg_type === 'balance' && msg.balance) {
      const b = msg.balance as { balance: number; currency: string }
      setBalance(b.balance)
      setCurrency(b.currency)
    }

    if (msg.msg_type === 'proposal' && msg.proposal) {
      const p = msg.proposal as { id: string }
      pendingProposalId.current = p.id
    }

    if (msg.msg_type === 'buy' && msg.buy) {
      const buyData = msg.buy as { contract_id: number }
      setBotStatus(s => ({ ...s, currentStep: 'contract_open' }))

      send({
        proposal_open_contract: 1,
        contract_id: buyData.contract_id,
        subscribe: 1,
        req_id: 10,
      })
    }

    if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract) {
      const poc = msg.proposal_open_contract as {
        is_sold?: number; profit?: number; entry_tick?: number;
        contract_type?: string; sell_price?: number
      }
      if (poc.is_sold) {
        const result = poc.profit ?? 0
        setProfit(p => p + result)
        if (result >= 0) setWins(w => w + 1)
        else             setLosses(l => l + 1)
        setBotStatus(s => ({ ...s, currentStep: 'contract_closed' }))

        const now = new Date()
        const trade: Trade = {
          id:        `${Date.now()}-${Math.random()}`,
          hora:      now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          tipo:      poc.contract_type ?? '—',
          tickFinal: poc.entry_tick ?? 0,
          preco:     `$${(poc.sell_price ?? 0).toFixed(2)}`,
          resultado: result,
        }
        setTrades(t => [trade, ...t].slice(0, 500))

        setTimeout(() => setBotStatus(s => ({ ...s, currentStep: 'idle' })), 1500)
      }
    }
  }, [send])

  // ── Conexão WebSocket ──────────────────────────────────────────────────────
  //
  // ✅ CORREÇÃO PRINCIPAL:
  //    Lê o token OAuth2 do localStorage (guardado pelo callback de autenticação)
  //    em vez das variáveis de ambiente NEXT_PUBLIC_* que estavam sempre vazias.
  //
  // ✅ CORREÇÃO SECUNDÁRIA:
  //    Lê o accountId do localStorage onde o auth-context o guarda após login.

  const connect = useCallback(async () => {
    if (!mountedRef.current) return
    if (wsRef.current && wsRef.current.readyState < 2) {
      wsRef.current.close()
    }

    // ── ANTES (não funcionava — variáveis de ambiente sempre vazias) ──────────
    // const oauthToken = process.env.NEXT_PUBLIC_OAUTH_TOKEN || ''
    // const accountId  = process.env.NEXT_PUBLIC_ACCOUNT_ID  || ''

    // ── DEPOIS (lê os dados reais do utilizador autenticado) ─────────────────
    const oauthToken = localStorage.getItem('token')             || ''
    const accountId  = localStorage.getItem('currentAccountId') || ''

    let wsUrl = WS_PUBLIC_URL

    if (oauthToken && accountId) {
      try {
        wsUrl = await fetchOtpWsUrl(accountId, oauthToken)
        console.info('[WS] OTP obtido — a conectar com autenticação')
      } catch (err) {
        console.warn('[WS] Falha ao obter OTP, a usar WS público:', err)
        wsUrl = WS_PUBLIC_URL
      }
    } else {
      // Agora só entra aqui se o utilizador ainda não fez login
      console.info('[WS] Sem credenciais — a usar WS público (modo não autenticado)')
    }

    if (!mountedRef.current) return

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }

      retryCount.current = 0
      setIsConnected(true)

      startHeartbeat(ws)
      flushQueue(ws)

      ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1, req_id: 1 }))

      // Balance só disponível com autenticação
      if (oauthToken && accountId) {
        ws.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 2 }))
      }
    }

    ws.onmessage = e => handleMessage(e.data as string)

    ws.onclose = e => {
      if (!mountedRef.current) return
      stopHeartbeat()
      setIsConnected(false)
      wsRef.current = null

      if (e.code === 1000) return

      const delay = Math.min(
        jitter(RECONNECT_BASE_MS * Math.pow(2, retryCount.current)),
        RECONNECT_MAX_MS,
      )
      retryCount.current++
      console.info(`[WS] Reconectar em ${(delay / 1000).toFixed(1)}s (tentativa ${retryCount.current})`)
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      console.warn('[WS] Erro na conexão WebSocket')
    }
  }, [handleMessage, startHeartbeat, stopHeartbeat, flushQueue])

  // ── Montar / desmontar ─────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      stopHeartbeat()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close(1000, 'unmount')
      }
    }
  }, [connect, stopHeartbeat])

  // ── Bot ────────────────────────────────────────────────────────────────────

  const startBot = useCallback(async () => {
    if (!currentStrategy) return
    setBotStatus({ isRunning: true, currentStep: 'analyzing' })
    pendingProposalId.current = null

    const contractTypeMap: Record<string, string> = {
      digit_diff:  'DIGITDIFF',
      digit_match: 'DIGITMATCH',
      over_under:  'DIGITOVER',
      even_odd:    'DIGITEVEN',
    }
    const contractType = contractTypeMap[currentStrategy.id] ?? 'DIGITDIFF'

    send({
      proposal: 1,
      amount: 1,
      basis: 'stake',
      contract_type: contractType,
      currency: 'USD',
      duration: 1,
      duration_unit: 't',
      underlying_symbol: SYMBOL,
      barrier: '5',
      req_id: 20,
    })

    const waitAndBuy = async () => {
      const deadline = Date.now() + 5_000
      while (!pendingProposalId.current && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 100))
      }

      if (!pendingProposalId.current) {
        console.warn('[Bot] Timeout a aguardar proposta')
        setBotStatus({ isRunning: false, currentStep: 'idle' })
        return
      }

      send({
        buy: pendingProposalId.current,
        price: 1,
        req_id: 21,
      })
    }

    waitAndBuy()
  }, [currentStrategy, send])

  const stopBot = useCallback(async () => {
    setBotStatus({ isRunning: false, currentStep: 'idle' })
  }, [])

  const clearTrades = useCallback(async () => {
    setTrades([])
    setWins(0)
    setLosses(0)
    setProfit(0)
  }, [])

  // ── Desconexão explícita (para logout) ─────────────────────────────────────
  const disconnect = useCallback(() => {
    mountedRef.current = false
    stopHeartbeat()
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close(1000, 'logout')
      wsRef.current = null
    }
    setIsConnected(false)
    digitHistory.current = []
    messageQueue.current = []
  }, [stopHeartbeat])

  // ── Valor do contexto ──────────────────────────────────────────────────────
  const value: TradingContextValue = {
    balance,
    profit,
    wins,
    losses,
    currency,
    lastDigit,
    chartData,
    isConnected,
    loading,
    selectedTicks,
    setSelectedTicks,
    trades,
    clearTrades,
    isLoadingTrades,
    strategies,
    currentStrategy,
    setCurrentStrategy,
    botStatus,
    startBot,
    stopBot,
    disconnect,
  }

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTrading() {
  const ctx = useContext(TradingContext)
  if (!ctx) throw new Error('useTrading must be used inside <TradingProvider>')
  return ctx
}
