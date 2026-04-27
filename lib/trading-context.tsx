'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { api, derivWs, Strategy, Trade, BotStatus, ChartData, CandleData, TickData } from './api'
import { useAuth } from './auth-context'

interface TradingContextType {
  balance: number
  profit: number
  wins: number
  losses: number
  currency: string
  strategies: Strategy[]
  currentStrategy: Strategy | null
  setCurrentStrategy: (s: Strategy) => Promise<void>
  botStatus: BotStatus
  startBot: () => Promise<void>
  stopBot: () => Promise<void>
  trades: Trade[]
  clearTrades: () => Promise<void>
  chartData: ChartData | null
  selectedTicks: number
  setSelectedTicks: (n: number) => void
  lastDigit: number
  isConnected: boolean
  isLoadingStrategies: boolean
  isLoadingTrades: boolean
}

const TradingContext = createContext<TradingContextType | undefined>(undefined)

const INIT_BOT: BotStatus = { isRunning: false, currentStep: 'idle', progress: 0 }

const INIT_CHART: ChartData = {
  lastDigit: 2,
  ticks: 25,
  barData: Array.from({ length: 10 }, (_, i) => ({
    digit: i,
    percentage: 10,
    isHighlight: i === 2,
    isLow: false,
  })),
  candleData: [],
  lineData: [],
}

export function TradingProvider({ children }: { children: ReactNode }) {
  const { currentAccount, isAuthenticated, wsConnected } = useAuth()

  const [balance, setBalance] = useState(0)
  const [profit, setProfit] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [currency, setCurrency] = useState('USD')

  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [currentStrategy, setCurrentStrategyState] = useState<Strategy | null>(null)
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false)

  const [botStatus, setBotStatus] = useState<BotStatus>(INIT_BOT)

  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoadingTrades, setIsLoadingTrades] = useState(false)

  const [chartData, setChartData] = useState<ChartData | null>(INIT_CHART)
  const [selectedTicks, setSelectedTicks] = useState(25)
  const [lastDigit, setLastDigit] = useState(2)
  const [isConnected, setIsConnected] = useState(false)

  // Usar ref para digit counts para evitar stale closures
  const digitCountsRef = useRef<number[]>(Array(10).fill(0))
  const totalTicksRef = useRef(0)

  // ── Sincronizar saldo da conta ─────────────────────────────────────────

  useEffect(() => {
    if (currentAccount) {
      setBalance(currentAccount.balance)
      setCurrency(currentAccount.currency)
    }
  }, [currentAccount])

  // ── Carregar dados iniciais ────────────────────────────────────────────

  useEffect(() => {
    loadStrategies()
    loadTrades()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadStrategies = async () => {
    setIsLoadingStrategies(true)
    try {
      const { data } = await api.getStrategies()
      setStrategies(data)
      setCurrentStrategyState(data.find(s => s.isActive) || data[0] || null)
    } catch {
      // getStrategies já tem fallback interno
    } finally {
      setIsLoadingStrategies(false)
    }
  }

  const loadTrades = async () => {
    setIsLoadingTrades(true)
    try {
      const { data } = await api.getTrades()
      setTrades(data)
      calcStats(data)
    } catch {
      setTrades([])
    } finally {
      setIsLoadingTrades(false)
    }
  }

  const calcStats = (list: Trade[]) => {
    setWins(list.filter(t => t.resultado >= 0).length)
    setLosses(list.filter(t => t.resultado < 0).length)
    setProfit(list.reduce((a, t) => a + t.resultado, 0))
  }

  // ── Setup WebSocket listeners quando WS conecta ───────────────────────

  useEffect(() => {
    if (!wsConnected) {
      setIsConnected(false)
      return
    }

    setIsConnected(true)

    // Subscrever ticks para o gráfico
    derivWs.subscribeTicks('1HZ100V').catch(e => console.error('[Trading] Subscribe ticks failed:', e))

    // Carregar histórico de candles
    derivWs.getTicksHistory('1HZ100V', 60, 'candles', 60)
      .then((res: unknown) => {
        const r = res as { candles?: Array<{ open: string; high: string; low: string; close: string; epoch: number }> }
        if (r?.candles) {
          const candles: CandleData[] = r.candles.map(c => ({
            x: c.epoch * 1000,
            o: parseFloat(c.open),
            h: parseFloat(c.high),
            l: parseFloat(c.low),
            c: parseFloat(c.close),
          }))
          setChartData(prev => prev ? { ...prev, candleData: candles } : prev)
        }
      })
      .catch(() => {})

    // ── Listeners ────────────────────────────────────────────────────────

    const offBalance = derivWs.on('balance', (msg: unknown) => {
      const d = msg as { balance?: { balance: number; currency: string } }
      if (d.balance) {
        setBalance(d.balance.balance)
        setCurrency(d.balance.currency)
      }
    })

    const offTick = derivWs.on('tick', (msg: unknown) => {
      const d = msg as { tick?: TickData }
      if (d.tick) handleTick(d.tick)
    })

    const offOHLC = derivWs.on('ohlc', (msg: unknown) => {
      const d = msg as { ohlc?: { open: number; high: number; low: number; close: number; epoch: number } }
      if (d.ohlc) handleCandle(d.ohlc)
    })

    const offTx = derivWs.on('transaction', (msg: unknown) => {
      const d = msg as { transaction?: { balance_after: number } }
      if (d.transaction) setBalance(d.transaction.balance_after)
    })

    const offBuy = derivWs.on('buy', (msg: unknown) => {
      const d = msg as { buy?: { balance_after: number } }
      if (d.buy) {
        setBalance(d.buy.balance_after)
        setBotStatus(prev => ({ ...prev, currentStep: 'contract_open' }))
      }
    })

    const offPOC = derivWs.on('proposal_open_contract', (msg: unknown) => {
      const d = msg as { proposal_open_contract?: { is_sold: number; profit: number; contract_id: number; exit_tick_time?: number } }
      const poc = d.proposal_open_contract
      if (poc?.is_sold) {
        setBotStatus(prev => ({ ...prev, currentStep: 'contract_closed' }))
        if (poc.profit !== undefined) {
          setProfit(p => p + poc.profit)
          if (poc.profit >= 0) setWins(w => w + 1)
          else setLosses(l => l + 1)
        }
      }
    })

    const offBotStatus = derivWs.on('bot_status', (msg: unknown) => {
      setBotStatus(msg as BotStatus)
    })

    const offTrade = derivWs.on('trade', (msg: unknown) => {
      const trade = msg as Trade
      setTrades(prev => {
        const updated = [trade, ...prev]
        calcStats(updated)
        return updated
      })
    })

    return () => {
      // Cleanup de todos os listeners
      offBalance()
      offTick()
      offOHLC()
      offTx()
      offBuy()
      offPOC()
      offBotStatus()
      offTrade()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected])

  // ── Handlers de tick e candle ──────────────────────────────────────────

  const handleTick = useCallback((tick: TickData) => {
    const str = tick.quote.toFixed(2)
    const digit = parseInt(str.slice(-1), 10)
    setLastDigit(digit)

    // Atualizar contagens com refs (sem stale closure)
    digitCountsRef.current[digit]++
    totalTicksRef.current++
    const total = totalTicksRef.current
    const counts = [...digitCountsRef.current]

    setChartData(prev => {
      if (!prev) return prev
      const maxCount = Math.max(...counts)
      const minCount = Math.min(...counts)
      return {
        ...prev,
        lastDigit: digit,
        barData: counts.map((count, idx) => ({
          digit: idx,
          percentage: total > 0 ? (count / total) * 100 : 10,
          isHighlight: count === maxCount,
          isLow: count === minCount && count < maxCount,
        })),
      }
    })
  }, [])

  const handleCandle = useCallback((ohlc: { open: number; high: number; low: number; close: number; epoch: number }) => {
    setChartData(prev => {
      if (!prev) return prev
      const newCandle: CandleData = {
        x: ohlc.epoch * 1000,
        o: ohlc.open, h: ohlc.high, l: ohlc.low, c: ohlc.close,
      }
      const existing = [...(prev.candleData || [])]
      const last = existing[existing.length - 1]
      if (last && last.x === newCandle.x) {
        existing[existing.length - 1] = newCandle
      } else {
        existing.push(newCandle)
        if (existing.length > 60) existing.shift()
      }
      return { ...prev, candleData: existing }
    })
  }, [])

  // ── Estratégia ─────────────────────────────────────────────────────────

  const setCurrentStrategy = async (strategy: Strategy) => {
    setCurrentStrategyState(strategy)
    setStrategies(prev => prev.map(s => ({ ...s, isActive: s.id === strategy.id })))
    await api.setStrategy(strategy.id).catch(() => {})
  }

  // ── Bot ────────────────────────────────────────────────────────────────

  const startBot = useCallback(async () => {
    try {
      const { status } = await api.startBot()
      setBotStatus(status)
    } catch {
      setBotStatus({ isRunning: true, currentStep: 'analyzing', progress: 0 })
    }
  }, [])

  const stopBot = useCallback(async () => {
    try {
      const { status } = await api.stopBot()
      setBotStatus(status)
    } catch {
      setBotStatus({ isRunning: false, currentStep: 'idle', progress: 0 })
    }
  }, [])

  // ── Trades ─────────────────────────────────────────────────────────────

  const clearTrades = async () => {
    await api.clearTrades().catch(() => {})
    setTrades([])
    setWins(0)
    setLosses(0)
    setProfit(0)
  }

  // ── Ticks selecionados ─────────────────────────────────────────────────

  const handleSetSelectedTicks = (ticks: number) => {
    setSelectedTicks(ticks)
    // Resetar contagens de dígitos
    digitCountsRef.current = Array(10).fill(0)
    totalTicksRef.current = 0
    setChartData(prev => prev ? { ...prev, ticks, barData: Array.from({ length: 10 }, (_, i) => ({ digit: i, percentage: 10, isHighlight: false, isLow: false })) } : prev)
  }

  return (
    <TradingContext.Provider value={{
      balance, profit, wins, losses, currency,
      strategies, currentStrategy, setCurrentStrategy,
      botStatus, startBot, stopBot,
      trades, clearTrades,
      chartData, selectedTicks, setSelectedTicks: handleSetSelectedTicks,
      lastDigit, isConnected,
      isLoadingStrategies, isLoadingTrades,
    }}>
      {children}
    </TradingContext.Provider>
  )
}

export function useTrading() {
  const ctx = useContext(TradingContext)
  if (!ctx) throw new Error('useTrading must be used within TradingProvider')
  return ctx
}
