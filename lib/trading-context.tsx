'use client'

/**
 * lib/trading-context.tsx
 *
 * Contexto global de trading — integração WebSocket real da Deriv.
 *
 * Fluxo conforme documentação oficial:
 *  1. REST POST /trading/v1/options/accounts/{accountId}/otp  → URL WS autenticada
 *  2. new WebSocket(otpUrl)  → ligação autenticada (demo ou real)
 *  3. Subscreve: ticks_history (candles) + ticks (tempo real) + balance
 *  4. Dados de gráfico fluem via setChartData → chart-section lê via refs (zero re-renders extra)
 *  5. Dados de UI (saldo, trades, dígito) → setState controlado
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

// ─────────────────────────────────────────────────────────────────────────────
// Tipos exportados (consumidos pelos componentes)
// ─────────────────────────────────────────────────────────────────────────────

export interface BarEntry {
  digit: number
  percentage: number
  isHighlight: boolean
  isLow: boolean
}

export interface CandleData {
  x: number   // timestamp ms
  o: number
  h: number
  l: number
  c: number
}

export interface ChartData {
  barData: BarEntry[]
  candleData: CandleData[]
  lastDigit: number
}

export interface Trade {
  id: string | number
  hora: string
  tipo: string
  tickFinal: string | number
  preco: string
  resultado: number
  amount?: number
  created_at?: string
}

export interface Strategy {
  id: string
  name: string
  contractType: string
  duration: number
  durationUnit: 's' | 'm' | 'h' | 't'
  stake: number
  symbol: string
}

export interface BotStatus {
  isRunning: boolean
  currentStep: 'idle' | 'analyzing' | 'contract_open' | 'contract_closed'
}

export interface BuyParams {
  contractType: string
  duration: number
  durationUnit: string
  stake: number
  symbol?: string
}

interface TradingContextValue {
  isConnected: boolean
  balance: number
  profit: number
  wins: number
  losses: number
  currency: string
  currentPrice: number
  lastDigit: number
  chartData: ChartData
  selectedTicks: number
  setSelectedTicks: (n: number) => void
  trades: Trade[]
  isLoadingTrades: boolean
  clearTrades: () => void
  strategies: Strategy[]
  currentStrategy: Strategy | null
  setCurrentStrategy: (s: Strategy) => void
  botStatus: BotStatus
  startBot: () => void
  stopBot: () => void
  buyContract: (params: BuyParams) => void
  sellContract: (contractId: number) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const BASE_REST      = 'https://api.derivws.com'
const PUBLIC_WS_URL  = 'wss://api.derivws.com/trading/v1/options/ws/public'
const DEFAULT_SYMBOL = '1HZ100V'
const MAX_CANDLES    = 120
const MAX_DIGIT_HIST = 1000
const PING_MS        = 25_000
const RECONNECT_BASE = 2_000
const RECONNECT_MAX  = 30_000

const DEFAULT_STRATEGIES: Strategy[] = [
  { id: 'even', name: 'Digit Par',     contractType: 'DIGITEVEN', duration: 1, durationUnit: 't', stake: 1, symbol: DEFAULT_SYMBOL },
  { id: 'odd',  name: 'Digit Ímpar',   contractType: 'DIGITODD',  duration: 1, durationUnit: 't', stake: 1, symbol: DEFAULT_SYMBOL },
  { id: 'rise', name: 'Subida (CALL)', contractType: 'CALL',       duration: 5, durationUnit: 't', stake: 1, symbol: DEFAULT_SYMBOL },
  { id: 'fall', name: 'Queda (PUT)',   contractType: 'PUT',        duration: 5, durationUnit: 't', stake: 1, symbol: DEFAULT_SYMBOL },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers puros
// ─────────────────────────────────────────────────────────────────────────────

function getLastDigit(price: number): number {
  const s = price.toFixed(2)
  return parseInt(s[s.length - 1], 10)
}

function computeBarData(history: number[]): BarEntry[] {
  const counts = Array(10).fill(0)
  history.forEach(d => counts[d]++)
  const total = history.length || 1
  const pcts  = counts.map((c: number) => (c / total) * 100)
  const max   = Math.max(...pcts)
  const min   = Math.min(...pcts)
  return pcts.map((pct: number, digit: number) => ({
    digit,
    percentage: pct,
    isHighlight: pct === max,
    isLow: pct === min,
  }))
}

function formatHora(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleTimeString('pt-PT', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto
// ─────────────────────────────────────────────────────────────────────────────

const TradingContext = createContext<TradingContextValue | null>(null)

export function useTrading(): TradingContextValue {
  const ctx = useContext(TradingContext)
  if (!ctx) throw new Error('useTrading deve estar dentro de <TradingProvider>')
  return ctx
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function TradingProvider({ children }: { children: ReactNode }) {

  // ── Refs internas — não causam re-render ─────────────────────────────────
  const wsRef             = useRef<WebSocket | null>(null)
  const pingRef           = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const reqIdRef          = useRef(1)
  const pendingRef        = useRef<Map<number, (d: unknown) => void>>(new Map())
  const digitHistoryRef   = useRef<number[]>([])
  const candleBufferRef   = useRef<CandleData[]>([])
  const tickSubIdRef      = useRef<string | null>(null)
  const openContractRef   = useRef<{ contractId: number; subId?: string } | null>(null)
  const botTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef        = useRef(true)
  const selectedTicksRef  = useRef(100)
  const initialBalanceRef = useRef<number | null>(null)
  const currentStrategyRef = useRef<Strategy | null>(DEFAULT_STRATEGIES[0])

  // ── Estado React — causa re-render apenas nos componentes subscritos ──────
  const [isConnected,     setIsConnected]     = useState(false)
  const [balance,         setBalance]         = useState(0)
  const [profit,          setProfit]          = useState(0)
  const [wins,            setWins]            = useState(0)
  const [losses,          setLosses]          = useState(0)
  const [currency,        setCurrency]        = useState('USD')
  const [currentPrice,    setCurrentPrice]    = useState(0)
  const [lastDigit,       setLastDigit]       = useState(0)
  const [chartData,       setChartData]       = useState<ChartData>({ barData: [], candleData: [], lastDigit: 0 })
  const [selectedTicks,   _setSelectedTicks]  = useState(100)
  const [trades,          setTrades]          = useState<Trade[]>([])
  const [strategies]                          = useState<Strategy[]>(DEFAULT_STRATEGIES)
  const [currentStrategy, _setCurrentStrategy] = useState<Strategy | null>(DEFAULT_STRATEGIES[0])
  const [botStatus,       setBotStatus]       = useState<BotStatus>({ isRunning: false, currentStep: 'idle' })

  const setSelectedTicks = useCallback((n: number) => {
    selectedTicksRef.current = n
    _setSelectedTicks(n)
    // Recalcular barras imediatamente com nova janela
    const window  = digitHistoryRef.current.slice(-n)
    const barData = computeBarData(window)
    setChartData(prev => ({ ...prev, barData }))
  }, [])

  const setCurrentStrategy = useCallback((s: Strategy) => {
    currentStrategyRef.current = s
    _setCurrentStrategy(s)
  }, [])

  // ── Envio WS com Promise e timeout ───────────────────────────────────────

  const send = useCallback((payload: Record<string, unknown>): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket não está aberto'))
      }
      const id = reqIdRef.current++
      payload.req_id = id
      pendingRef.current.set(id, resolve)
      ws.send(JSON.stringify(payload))
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id)
          reject(new Error(`Timeout req_id=${id}`))
        }
      }, 15_000)
    })
  }, [])

  // ── Handler de mensagens WS ───────────────────────────────────────────────

  const onMessage = useCallback((evt: MessageEvent) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(evt.data as string) } catch { return }

    // Resolver promise pendente por req_id
    const rid = msg.req_id as number | undefined
    if (rid && pendingRef.current.has(rid)) {
      pendingRef.current.get(rid)!(msg)
      pendingRef.current.delete(rid)
    }

    const type = msg.msg_type as string

    // ── TICK EM TEMPO REAL ────────────────────────────────────────────────
    if (type === 'tick') {
      const tick  = msg.tick as Record<string, unknown>
      const price = tick.quote as number
      const epoch = tick.epoch as number
      tickSubIdRef.current = tick.id as string

      // Actualizar estado de preço e dígito
      setCurrentPrice(price)
      const digit = getLastDigit(price)
      setLastDigit(digit)

      // Histórico de dígitos (mutação directa na ref)
      const hist = digitHistoryRef.current
      hist.push(digit)
      if (hist.length > MAX_DIGIT_HIST) hist.shift()

      // Barras com janela seleccionada
      const windowSlice = hist.slice(-selectedTicksRef.current)
      const barData     = computeBarData(windowSlice)

      // Candle do minuto actual (mutação directa na ref do buffer)
      const buf      = candleBufferRef.current
      const msNow    = epoch * 1000
      const minStart = Math.floor(msNow / 60_000) * 60_000
      const last     = buf[buf.length - 1]

      if (last && last.x === minStart) {
        // Actualizar candle em curso (high/low/close)
        last.h = Math.max(last.h, price)
        last.l = Math.min(last.l, price)
        last.c = price
      } else {
        // Novo minuto → novo candle
        buf.push({ x: minStart, o: price, h: price, l: price, c: price })
        if (buf.length > MAX_CANDLES) buf.shift()
      }

      // Um único setState agrupa barras + candles + dígito
      setChartData({
        barData,
        candleData: buf.slice(),   // cópia rasa — React detecta a mudança de referência
        lastDigit: digit,
      })
      return
    }

    // ── HISTÓRICO DE CANDLES ──────────────────────────────────────────────
    if (type === 'candles') {
      const raw = msg.candles as Array<Record<string, number>> | undefined
      if (!Array.isArray(raw)) return
      const parsed: CandleData[] = raw.map(c => ({
        x: c.epoch * 1000,
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close,
      }))
      candleBufferRef.current = parsed.slice(-MAX_CANDLES)
      setChartData(prev => ({ ...prev, candleData: candleBufferRef.current.slice() }))
      return
    }

    // ── SALDO ─────────────────────────────────────────────────────────────
    if (type === 'balance') {
      const b = msg.balance as Record<string, unknown> | undefined
      if (!b) return
      const newBal = b.balance as number
      setCurrency((b.currency as string) ?? 'USD')
      setBalance(newBal)
      if (initialBalanceRef.current === null) initialBalanceRef.current = newBal
      setProfit(+(newBal - (initialBalanceRef.current ?? newBal)).toFixed(2))
      return
    }

    // ── COMPRA CONFIRMADA ─────────────────────────────────────────────────
    if (type === 'buy') {
      if (msg.error) {
        console.error('[WS] Erro na compra:', msg.error)
        setBotStatus(prev => ({ ...prev, currentStep: 'idle' }))
        return
      }
      const buy = msg.buy as Record<string, unknown>
      openContractRef.current = { contractId: buy.contract_id as number }
      setBotStatus(prev => ({ ...prev, currentStep: 'contract_open' }))
      return
    }

    // ── ACTUALIZAÇÕES DE CONTRATO ABERTO ──────────────────────────────────
    if (type === 'proposal_open_contract') {
      const poc = msg.proposal_open_contract as Record<string, unknown> | undefined
      if (!poc) return

      // Guardar subscription id na primeira mensagem
      if (poc.id && openContractRef.current && !openContractRef.current.subId) {
        openContractRef.current.subId = poc.id as string
      }

      const status = poc.status as string
      const isClosed = status === 'sold' || status === 'won' || status === 'lost' || !!poc.is_sold

      if (!isClosed) return

      const pnl   = (poc.profit as number) ?? 0
      const isWin = pnl >= 0
      const sellP = ((poc.sell_price ?? poc.bid_price ?? 0) as number)
      const buyP  = ((poc.buy_price ?? 0) as number)
      const epoch = ((poc.sell_time ?? poc.date_expiry ?? Math.floor(Date.now() / 1000)) as number)

      const trade: Trade = {
        id:         poc.contract_id as number,
        hora:       formatHora(epoch),
        tipo:       (poc.contract_type as string) ?? '—',
        tickFinal:  getLastDigit((poc.exit_tick ?? 0) as number),
        preco:      `$${sellP.toFixed(2)}`,
        resultado:  +pnl.toFixed(2),
        amount:     +buyP.toFixed(2),
        created_at: new Date(((poc.purchase_time as number) ?? epoch) * 1000).toISOString(),
      }

      setTrades(prev => [trade, ...prev].slice(0, 500))
      if (isWin) setWins(w => w + 1)
      else       setLosses(l => l + 1)

      // Cancelar subscrição do contrato fechado
      if (openContractRef.current?.subId) {
        send({ forget: openContractRef.current.subId }).catch(() => {})
      }
      openContractRef.current = null
      setBotStatus(prev => ({ ...prev, currentStep: 'contract_closed' }))

      // Voltar a 'analyzing' se o bot ainda estiver activo
      setTimeout(() => {
        if (mountedRef.current) {
          setBotStatus(prev =>
            prev.isRunning ? { ...prev, currentStep: 'analyzing' } : prev
          )
        }
      }, 1_200)
    }
  }, [send])

  // ── Subscrições após ligar ────────────────────────────────────────────────

  const initSubscriptions = useCallback(async () => {
    // Histórico de candles (1 minuto de granularidade)
    try {
      await send({
        ticks_history: DEFAULT_SYMBOL,
        end:           'latest',
        count:         MAX_CANDLES,
        style:         'candles',
        granularity:   60,
      })
    } catch (e) { console.warn('[WS] ticks_history falhou:', e) }

    // Ticks em tempo real
    try {
      if (tickSubIdRef.current) {
        await send({ forget: tickSubIdRef.current }).catch(() => {})
        tickSubIdRef.current = null
      }
      await send({ ticks: DEFAULT_SYMBOL, subscribe: 1 })
    } catch (e) { console.warn('[WS] ticks subscribe falhou:', e) }
  }, [send])

  // ── Ligação WebSocket ─────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current)

    // Fechar WS anterior limpo
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      wsRef.current.onmessage = null
      wsRef.current.close()
      wsRef.current = null
    }

    // Tentar ligação autenticada via OTP; fallback para público
    let wsUrl = PUBLIC_WS_URL
    const token     = typeof window !== 'undefined'
      ? (localStorage.getItem('deriv_access_token') ?? localStorage.getItem('token'))
      : null
    const accountId = typeof window !== 'undefined'
      ? localStorage.getItem('deriv_account_id')
      : null

    if (token && accountId) {
      try {
        const res = await fetch(
          `${BASE_REST}/trading/v1/options/accounts/${accountId}/otp`,
          {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Deriv-App-ID':  process.env.NEXT_PUBLIC_DERIV_APP_ID ?? '',
              'Content-Type':  'application/json',
            },
          }
        )
        if (res.ok) {
          const json = await res.json()
          const url  = json?.data?.url as string | undefined
          if (url) {
            wsUrl = url
            console.log('[WS] Ligação autenticada obtida')
          }
        } else {
          console.warn('[WS] OTP retornou', res.status, '— usando endpoint público')
        }
      } catch (e) {
        console.warn('[WS] Erro ao obter OTP:', e, '— usando endpoint público')
      }
    } else {
      console.log('[WS] Sem credenciais — usando endpoint público (apenas dados de mercado)')
    }

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = async () => {
      if (!mountedRef.current) return
      console.log('[WS] Ligado com sucesso:', wsUrl)
      setIsConnected(true)
      reconnectAttempts.current = 0

      // Ping a cada 25 s para manter a ligação viva
      if (pingRef.current) clearInterval(pingRef.current)
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: 1, req_id: reqIdRef.current++ }))
        }
      }, PING_MS)

      // Subscrever saldo apenas se autenticado
      if (wsUrl !== PUBLIC_WS_URL) {
        try {
          await send({ balance: 1, subscribe: 1 })
        } catch (e) { console.warn('[WS] balance subscribe falhou:', e) }
      }

      // Subscrições de mercado
      await initSubscriptions()
    }

    ws.onmessage = onMessage

    ws.onerror = (e) => {
      console.warn('[WS] Erro de socket:', e)
    }

    ws.onclose = (ev) => {
      if (!mountedRef.current) return
      console.warn(`[WS] Fechado — código ${ev.code}: ${ev.reason}`)
      setIsConnected(false)
      if (pingRef.current) clearInterval(pingRef.current)

      // Reconexão com exponential back-off
      const delay = Math.min(RECONNECT_BASE * 2 ** reconnectAttempts.current, RECONNECT_MAX)
      reconnectAttempts.current++
      console.log(`[WS] Reconectar em ${delay}ms (tentativa ${reconnectAttempts.current})`)
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, delay)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, initSubscriptions, onMessage])
  // Nota: connect não inclui connect no array de deps para evitar loop infinito

  // ── Montagem / desmontagem ────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
      if (pingRef.current)    clearInterval(pingRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (botTimerRef.current)  clearInterval(botTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Apenas na montagem

  // Reconectar quando accountId muda no localStorage (troca de conta)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'deriv_account_id' || e.key === 'deriv_access_token') {
        console.log('[WS] Credenciais alteradas — a religar...')
        reconnectAttempts.current = 0
        connect()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [connect])

  // ── Operações de trading ──────────────────────────────────────────────────

  const buyContract = useCallback(async (params: BuyParams) => {
    setBotStatus(prev => ({ ...prev, currentStep: 'analyzing' }))
    try {
      // 1. Obter proposta de preço
      const propRes = await send({
        proposal:          1,
        amount:            params.stake,
        basis:             'stake',
        contract_type:     params.contractType,
        currency:          'USD',
        duration:          params.duration,
        duration_unit:     params.durationUnit,
        underlying_symbol: params.symbol ?? DEFAULT_SYMBOL,
      }) as Record<string, unknown>

      if (propRes.error) {
        console.error('[WS] Erro na proposta:', propRes.error)
        setBotStatus(prev => ({ ...prev, currentStep: 'idle' }))
        return
      }

      const proposal   = propRes.proposal as Record<string, unknown>
      const proposalId = proposal.id as string
      const askPrice   = proposal.ask_price as number

      // 2. Comprar o contrato
      const buyRes = await send({ buy: proposalId, price: askPrice }) as Record<string, unknown>

      if (buyRes.error) {
        console.error('[WS] Erro na compra:', buyRes.error)
        setBotStatus(prev => ({ ...prev, currentStep: 'idle' }))
        return
      }

      const buy        = buyRes.buy as Record<string, unknown>
      const contractId = buy.contract_id as number
      openContractRef.current = { contractId }

      // 3. Subscrever actualizações do contrato
      const pocRes = await send({
        proposal_open_contract: 1,
        contract_id:            contractId,
        subscribe:              1,
      }) as Record<string, unknown>

      const poc = pocRes.proposal_open_contract as Record<string, unknown> | undefined
      if (poc?.id && openContractRef.current) {
        openContractRef.current.subId = poc.id as string
      }

      setBotStatus(prev => ({ ...prev, currentStep: 'contract_open' }))
    } catch (e) {
      console.error('[WS] buyContract falhou:', e)
      setBotStatus(prev => ({ ...prev, currentStep: 'idle' }))
    }
  }, [send])

  const sellContract = useCallback(async (contractId: number) => {
    try {
      await send({ sell: contractId, price: 0 })
    } catch (e) {
      console.error('[WS] sellContract falhou:', e)
    }
  }, [send])

  // ── Bot automático ────────────────────────────────────────────────────────

  const startBot = useCallback(() => {
    const strategy = currentStrategyRef.current
    if (!strategy) return
    setBotStatus({ isRunning: true, currentStep: 'analyzing' })

    const runOnce = () => {
      if (!mountedRef.current) return
      if (openContractRef.current) return   // já há contrato em curso
      buyContract({
        contractType: strategy.contractType,
        duration:     strategy.duration,
        durationUnit: strategy.durationUnit,
        stake:        strategy.stake,
        symbol:       strategy.symbol,
      })
    }

    runOnce()   // operação imediata
    // Fallback: se contrato não fechar em 90 s, tenta de novo
    if (botTimerRef.current) clearInterval(botTimerRef.current)
    botTimerRef.current = setInterval(runOnce, 90_000)
  }, [buyContract])

  const stopBot = useCallback(async () => {
    if (botTimerRef.current) { clearInterval(botTimerRef.current); botTimerRef.current = null }
    setBotStatus({ isRunning: false, currentStep: 'idle' })
    if (openContractRef.current) {
      await sellContract(openContractRef.current.contractId)
    }
  }, [sellContract])

  // ── Limpar histórico ──────────────────────────────────────────────────────

  const clearTrades = useCallback(() => {
    setTrades([])
    setWins(0)
    setLosses(0)
    setProfit(0)
    initialBalanceRef.current = balance
  }, [balance])

  // ── Value ─────────────────────────────────────────────────────────────────

  const value: TradingContextValue = {
    isConnected,
    balance,
    profit,
    wins,
    losses,
    currency,
    currentPrice,
    lastDigit,
    chartData,
    selectedTicks,
    setSelectedTicks,
    trades,
    isLoadingTrades: false,
    clearTrades,
    strategies,
    currentStrategy,
    setCurrentStrategy,
    botStatus,
    startBot,
    stopBot,
    buyContract,
    sellContract,
  }

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  )
}
