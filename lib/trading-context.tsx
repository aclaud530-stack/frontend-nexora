'use client'

// ============================================================
// NEXORA FOREX — Trading Context
//
// CORRECÇÃO CRÍTICA: esta versão NÃO abre um WebSocket próprio
// para a Deriv. A versão anterior abria wss://api.derivws.com
// directamente no browser, em paralelo com o WS do backend
// Nexora — causando:
//   ✗ 2 ligações WS concorrentes para a Deriv (limite é 5/user)
//   ✗ startBot enviava proposal/buy directamente para a Deriv,
//     ignorando o sistema de bots do backend
//   ✗ balance/ticks duplicados (um de cada WS)
//   ✗ bots do backend e bots locais totalmente desincronizados
//
// Agora todos os dados vêm do backend via BotsProvider/useNexoraWs.
// O dashboard lê daqui; os bots controlam-se via bots-context.
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react'

// ─── Tipos públicos ───────────────────────────────────────────

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
  barData:   BarEntry[]
  lastDigit: number
}

// ─── Contexto ─────────────────────────────────────────────────

interface TradingContextValue {
  // Dados de mercado (recebidos via WS do backend)
  balance:      number
  profit:       number
  wins:         number
  losses:       number
  currency:     string
  lastDigit:    number
  chartData:    ChartData | null
  // isConnected reflecte o wsStatus do backend, não um WS próprio
  isConnected:  boolean
  loading:      boolean

  selectedTicks:    number
  setSelectedTicks: (t: number) => void

  trades:          Trade[]
  clearTrades:     () => void
  isLoadingTrades: boolean

  strategies:         Strategy[]
  currentStrategy:    Strategy | null
  setCurrentStrategy: (s: Strategy) => void

  botStatus:   BotStatus

  // Métodos para injectar dados vindos do BotsProvider
  // (chamados pelos handlers de eventos WS em bots-context.tsx)
  _setBalance:    (b: number, c: string) => void
  _setTick:       (quote: number) => void
  _setBotStatus:  (s: BotStatus) => void
  _addTrade:      (t: Trade) => void
  _setConnected:  (v: boolean) => void
}

const TradingContext = createContext<TradingContextValue | undefined>(undefined)

// ─── Helpers de chart ─────────────────────────────────────────

const MAX_DIGIT_HISTORY = 1_000

function computeBarData(digits: number[], windowSize: number): BarEntry[] {
  const slice  = digits.slice(-windowSize)
  const counts = Array(10).fill(0)
  slice.forEach(d => counts[d]++)
  const total = slice.length || 1
  const pcts  = counts.map(c => (c / total) * 100)
  const max   = Math.max(...pcts)
  const min   = Math.min(...pcts)
  return pcts.map((pct, digit) => ({
    digit, percentage: pct, isHighlight: pct === max, isLow: pct === min,
  }))
}

// ─── Provider ─────────────────────────────────────────────────

export function TradingProvider({ children }: { children: ReactNode }) {
  const [balance,       setBalance]       = useState(0)
  const [currency,      setCurrency]      = useState('USD')
  const [profit,        setProfit]        = useState(0)
  const [wins,          setWins]          = useState(0)
  const [losses,        setLosses]        = useState(0)
  const [lastDigit,     setLastDigit]     = useState(0)
  const [chartData,     setChartData]     = useState<ChartData | null>(null)
  const [isConnected,   setIsConnected]   = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [selectedTicks, setSelectedTicks] = useState(100)
  const [trades,        setTrades]        = useState<Trade[]>([])
  const [botStatus,     setBotStatus]     = useState<BotStatus>({ isRunning: false, currentStep: 'idle' })
  const [strategies]                      = useState<Strategy[]>([
    { id: 'digit_diff',  name: 'Digit Differ' },
    { id: 'digit_match', name: 'Digit Match'  },
    { id: 'over_under',  name: 'Over/Under'   },
    { id: 'even_odd',    name: 'Even/Odd'     },
  ])
  const [currentStrategy, setCurrentStrategy] = useState<Strategy | null>(strategies[0])

  const digitHistory    = useRef<number[]>([])
  const selectedTicksRef = useRef(selectedTicks)
  useEffect(() => { selectedTicksRef.current = selectedTicks }, [selectedTicks])

  // ── Injecção de dados do backend ──────────────────────────────

  const _setBalance = useCallback((b: number, c: string) => {
    setBalance(b)
    setCurrency(c)
  }, [])

  const _setTick = useCallback((quote: number) => {
    const priceStr = quote.toFixed(2)
    const digit    = parseInt(priceStr[priceStr.length - 1], 10)
    digitHistory.current.push(digit)
    if (digitHistory.current.length > MAX_DIGIT_HISTORY)
      digitHistory.current = digitHistory.current.slice(-MAX_DIGIT_HISTORY)
    setLastDigit(digit)
    setLoading(false)
    const w = selectedTicksRef.current
    queueMicrotask(() => {
      setChartData({ barData: computeBarData(digitHistory.current, w), lastDigit: digit })
    })
  }, [])

  const _setBotStatus = useCallback((s: BotStatus) => setBotStatus(s), [])

  const _addTrade = useCallback((t: Trade) => {
    setTrades(prev => [t, ...prev].slice(0, 500))
    if (t.resultado >= 0) {
      setWins(w => w + 1)
      setProfit(p => p + t.resultado)
    } else {
      setLosses(l => l + 1)
      setProfit(p => p + t.resultado)
    }
  }, [])

  const _setConnected = useCallback((v: boolean) => setIsConnected(v), [])

  const clearTrades = useCallback(() => {
    setTrades([])
    setWins(0)
    setLosses(0)
    setProfit(0)
  }, [])

  return (
    <TradingContext.Provider value={{
      balance, profit, wins, losses, currency, lastDigit, chartData,
      isConnected, loading, selectedTicks, setSelectedTicks,
      trades, clearTrades, isLoadingTrades: false,
      strategies, currentStrategy, setCurrentStrategy,
      botStatus,
      _setBalance, _setTick, _setBotStatus, _addTrade, _setConnected,
    }}>
      {children}
    </TradingContext.Provider>
  )
}

export function useTrading() {
  const ctx = useContext(TradingContext)
  if (!ctx) throw new Error('useTrading must be used inside <TradingProvider>')
  return ctx
}
