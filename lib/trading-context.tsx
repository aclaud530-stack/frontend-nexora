'use client'

/**
 * trading-context.tsx
 *
 * WebSocket robusto com:
 * - Reconexão exponencial com jitter (evita thundering herd com muitos utilizadores)
 * - Heartbeat / ping-pong para detetar conexões mortas
 * - Fila de mensagens offline — enviadas após reconexão
 * - Tick sincronizado via timestamp do servidor (todos os clientes veem o mesmo instante)
 * - Dados do gráfico de barras calculados sem bloquear o render thread
 * - Limite de candles para evitar memory leaks com muitos utilizadores
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

export interface Candle {
  x: number   // timestamp ms
  o: number
  h: number
  l: number
  c: number
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
  candleData: Candle[]
  lastDigit:  number
}

interface TradingContextValue {
  // Estado de mercado
  balance:      number
  profit:       number
  wins:         number
  losses:       number
  currency:     string
  lastDigit:    number
  chartData:    ChartData | null
  isConnected:  boolean
  loading:      boolean

  // Tick selecionado
  selectedTicks:    number
  setSelectedTicks: (t: number) => void

  // Trades
  trades:          Trade[]
  clearTrades:     () => Promise<void>
  isLoadingTrades: boolean

  // Bot
  strategies:          Strategy[]
  currentStrategy:     Strategy | null
  setCurrentStrategy:  (s: Strategy) => void
  botStatus:           BotStatus
  startBot:            () => Promise<void>
  stopBot:             () => Promise<void>
}

const TradingContext = createContext<TradingContextValue | undefined>(undefined)

// ── Constantes de WebSocket ────────────────────────────────────────────────────

const WS_URL              = process.env.NEXT_PUBLIC_WS_URL || 'wss://ws.derivws.com/websockets/v3?app_id=1089'
const RECONNECT_BASE_MS   = 1_000      // 1 s inicial
const RECONNECT_MAX_MS    = 30_000     // máximo 30 s
const HEARTBEAT_INTERVAL  = 20_000     // ping a cada 20 s
const HEARTBEAT_TIMEOUT   = 10_000     // se não vier pong em 10 s → reconectar
const MAX_CANDLES         = 500        // limite de candles em memória
const MAX_DIGIT_HISTORY   = 1_000      // histórico de dígitos para calcular percentagens

// ── Utilitários ───────────────────────────────────────────────────────────────

/** Jitter aleatório para escalonar reconexões de múltiplos clientes */
function jitter(ms: number) {
  return ms + Math.random() * ms * 0.3
}

/** Calcula barData a partir do histórico de dígitos */
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

/** Agrega ticks em candles de 1 minuto */
function buildCandles(ticks: { epoch: number; price: number }[]): Candle[] {
  const map = new Map<number, { o: number; h: number; l: number; c: number }>()

  ticks.forEach(({ epoch, price }) => {
    const minute = Math.floor(epoch / 60) * 60 * 1000
    const existing = map.get(minute)
    if (!existing) {
      map.set(minute, { o: price, h: price, l: price, c: price })
    } else {
      existing.h = Math.max(existing.h, price)
      existing.l = Math.min(existing.l, price)
      existing.c = price
    }
  })

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .slice(-MAX_CANDLES)
    .map(([x, v]) => ({ x, ...v }))
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
  const wsRef            = useRef<WebSocket | null>(null)
  const reconnectTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer   = useRef<ReturnType<typeof setInterval> | null>(null)
  const pongTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount       = useRef(0)
  const messageQueue     = useRef<string[]>([])   // mensagens enviadas offline
  const digitHistory     = useRef<number[]>([])
  const tickHistory      = useRef<{ epoch: number; price: number }[]>([])
  const selectedTicksRef = useRef(selectedTicks)
  const mountedRef       = useRef(true)

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

      // Enviar ping à Deriv API
      ws.send(JSON.stringify({ ping: 1 }))

      // Timeout para pong
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

    // Pong — cancelar timeout
    if (msg.pong || msg.msg_type === 'ping') {
      if (pongTimer.current) clearTimeout(pongTimer.current)
      return
    }

    // Tick em tempo real
    if (msg.msg_type === 'tick' && msg.tick) {
      const tick = msg.tick as { quote: number; epoch: number }
      const price = tick.quote
      const epoch = tick.epoch

      // Último dígito
      const priceStr = price.toFixed(2)
      const digit    = parseInt(priceStr[priceStr.length - 1], 10)

      digitHistory.current.push(digit)
      if (digitHistory.current.length > MAX_DIGIT_HISTORY)
        digitHistory.current = digitHistory.current.slice(-MAX_DIGIT_HISTORY)

      tickHistory.current.push({ epoch, price })
      if (tickHistory.current.length > MAX_CANDLES * 60)
        tickHistory.current = tickHistory.current.slice(-MAX_CANDLES * 60)

      if (!mountedRef.current) return

      setLastDigit(digit)
      setLoading(false)

      // Calcular barData e candles num microtask para não bloquear o render
      const w = selectedTicksRef.current
      queueMicrotask(() => {
        if (!mountedRef.current) return
        const barData    = computeBarData(digitHistory.current, w)
        const candleData = buildCandles(tickHistory.current)
        setChartData({ barData, candleData, lastDigit: digit })
      })
    }

    // Histórico de ticks
    if (msg.msg_type === 'history' && msg.history) {
      const h = msg.history as { prices: number[]; times: number[] }
      const ticks = h.prices.map((price, i) => ({ price, epoch: h.times[i] }))
      tickHistory.current = ticks
      ticks.forEach(({ price }) => {
        const s = price.toFixed(2)
        digitHistory.current.push(parseInt(s[s.length - 1], 10))
      })
    }

    // Balance
    if (msg.msg_type === 'balance' && msg.balance) {
      const b = msg.balance as { balance: number; currency: string }
      setBalance(b.balance)
      setCurrency(b.currency)
    }

    // Compra confirmada
    if (msg.msg_type === 'buy' && msg.buy) {
      setBotStatus(s => ({ ...s, currentStep: 'contract_open' }))
    }

    // Proposta (contrato fechado)
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
  }, [])

  // ── Conexão WebSocket ──────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current && wsRef.current.readyState < 2) {
      wsRef.current.close()
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }

      retryCount.current = 0
      setIsConnected(true)

      startHeartbeat(ws)
      flushQueue(ws)

      // Subscrever ticks em tempo real (R_100 como exemplo — substituir pelo símbolo real)
      ws.send(JSON.stringify({ ticks: 'R_100', subscribe: 1 }))
      // Subscrever balance
      ws.send(JSON.stringify({ balance: 1, subscribe: 1 }))
    }

    ws.onmessage = e => handleMessage(e.data as string)

    ws.onclose = e => {
      if (!mountedRef.current) return
      stopHeartbeat()
      setIsConnected(false)
      wsRef.current = null

      // Não reconectar se foi um fecho intencional (código 1000)
      if (e.code === 1000) return

      // Backoff exponencial com jitter
      const delay = Math.min(
        jitter(RECONNECT_BASE_MS * Math.pow(2, retryCount.current)),
        RECONNECT_MAX_MS,
      )
      retryCount.current++
      console.info(`[WS] Reconectar em ${(delay / 1000).toFixed(1)}s (tentativa ${retryCount.current})`)
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      // onerror é sempre seguido de onclose — deixar onclose tratar a reconexão
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
        wsRef.current.onclose = null   // impedir reconexão no unmount
        wsRef.current.close(1000, 'unmount')
      }
    }
  }, [connect, stopHeartbeat])

  // ── Bot ────────────────────────────────────────────────────────────────────
  const startBot = useCallback(async () => {
    if (!currentStrategy) return
    setBotStatus({ isRunning: true, currentStep: 'analyzing' })
    send({ buy: 1, price: 1, parameters: { contract_type: 'DIGITMATCH', symbol: 'R_100', duration: 1, duration_unit: 't', amount: 1, basis: 'stake', barrier: '5' } })
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
