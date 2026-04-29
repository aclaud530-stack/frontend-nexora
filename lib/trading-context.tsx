'use client'

/**
 * lib/trading-context.tsx
 *
 * Usa o derivWs já existente em lib/api.ts — não cria um segundo WebSocket.
 *
 * Responsabilidades:
 *  - Subscrever ticks + candles em tempo real via derivWs
 *  - Subscrever saldo em tempo real (balance subscribe)
 *  - Subscrever transações (transaction subscribe) → histórico automático
 *  - Expor troca de conta com reconexão WS
 *  - Bot automático: proposal → buy → proposal_open_contract
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
import { derivWs, api, addLocalTrade, clearLocalTrades, type Account } from './api'
import { useAuth } from './auth-context'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface BarEntry {
  digit: number
  percentage: number
  isHighlight: boolean
  isLow: boolean
}

export interface CandleData {
  x: number
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

// ── Conta para o switcher ─────────────────────────────────────────────────────

export interface TradingAccount {
  loginid: string
  account_type: 'real' | 'demo'
  balance: number
  currency: string
  token: string
  is_virtual: boolean
  landing_company_shortcode?: string
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
  buyContract: (p: BuyParams) => void
  sellContract: (contractId: number) => void
  // ── Contas ────────────────────────────────────────────────────────────────
  availableAccounts: TradingAccount[]
  activeAccount: TradingAccount | null
  isSwitchingAccount: boolean
  switchAccount: (account: TradingAccount) => Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SYMBOL  = '1HZ100V'
const MAX_CANDLES     = 120
const MAX_DIGIT_HIST  = 1000

const DEFAULT_STRATEGIES: Strategy[] = [
  { id: 'even', name: 'Digit Par',     contractType: 'DIGITEVEN', duration: 1, durationUnit: 't', stake: 1, symbol: DEFAULT_SYMBOL },
  { id: 'odd',  name: 'Digit Ímpar',   contractType: 'DIGITODD',  duration: 1, durationUnit: 't', stake: 1, symbol: DEFAULT_SYMBOL },
  { id: 'rise', name: 'Subida (CALL)', contractType: 'CALL',       duration: 5, durationUnit: 't', stake: 1, symbol: DEFAULT_SYMBOL },
  { id: 'fall', name: 'Queda (PUT)',   contractType: 'PUT',        duration: 5, durationUnit: 't', stake: 1, symbol: DEFAULT_SYMBOL },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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

function toHora(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleTimeString('pt-PT', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// Lê contas guardadas no localStorage
function loadStoredAccounts(): TradingAccount[] {
  try {
    const raw = localStorage.getItem('trading_accounts')
    return raw ? (JSON.parse(raw) as TradingAccount[]) : []
  } catch {
    return []
  }
}

function loadActiveAccount(accounts: TradingAccount[]): TradingAccount | null {
  try {
    const loginid = localStorage.getItem('active_account')
    if (loginid) return accounts.find(a => a.loginid === loginid) ?? accounts[0] ?? null
    return accounts[0] ?? null
  } catch {
    return accounts[0] ?? null
  }
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
  const { currentAccount, wsConnected } = useAuth()

  // ── Refs mutáveis ─────────────────────────────────────────────────────────
  const digitHistRef      = useRef<number[]>([])
  const candleBufRef      = useRef<CandleData[]>([])
  const selectedTicksRef  = useRef(100)
  const initialBalRef     = useRef<number | null>(null)
  const openContractRef   = useRef<{ contractId: number; subId?: string } | null>(null)
  const botTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef        = useRef(true)
  const strategyRef       = useRef<Strategy | null>(DEFAULT_STRATEGIES[0])
  const unsubsRef         = useRef<Array<() => void>>([])

  // ── Estado React ──────────────────────────────────────────────────────────
  const [balance,          setBalance]          = useState(0)
  const [profit,           setProfit]           = useState(0)
  const [wins,             setWins]             = useState(0)
  const [losses,           setLosses]           = useState(0)
  const [currency,         setCurrency]         = useState('USD')
  const [currentPrice,     setCurrentPrice]     = useState(0)
  const [lastDigit,        setLastDigit]        = useState(0)
  const [chartData,        setChartData]        = useState<ChartData>({ barData: [], candleData: [], lastDigit: 0 })
  const [selectedTicks,    _setSelectedTicks]   = useState(100)
  const [trades,           setTrades]           = useState<Trade[]>([])
  const [isLoadingTrades,  setIsLoadingTrades]  = useState(false)
  const [strategies]                            = useState<Strategy[]>(DEFAULT_STRATEGIES)
  const [currentStrategy,  _setCurrentStrategy] = useState<Strategy | null>(DEFAULT_STRATEGIES[0])
  const [botStatus,        setBotStatus]        = useState<BotStatus>({ isRunning: false, currentStep: 'idle' })

  // ── Estado de contas ──────────────────────────────────────────────────────
  const storedAccounts = loadStoredAccounts()
  const [availableAccounts,   setAvailableAccounts]   = useState<TradingAccount[]>(storedAccounts)
  const [activeAccount,       setActiveAccount]       = useState<TradingAccount | null>(loadActiveAccount(storedAccounts))
  const [isSwitchingAccount,  setIsSwitchingAccount]  = useState(false)

  // ── Setters com sincronização de ref ──────────────────────────────────────

  const setSelectedTicks = useCallback((n: number) => {
    selectedTicksRef.current = n
    _setSelectedTicks(n)
    const barData = computeBarData(digitHistRef.current.slice(-n))
    setChartData(prev => ({ ...prev, barData }))
  }, [])

  const setCurrentStrategy = useCallback((s: Strategy) => {
    strategyRef.current = s
    _setCurrentStrategy(s)
  }, [])

  // ── Remover todos os listeners activos ────────────────────────────────────

  const removeAllListeners = useCallback(() => {
    unsubsRef.current.forEach(fn => fn())
    unsubsRef.current = []
  }, [])

  // ── Reset de estado ao trocar conta ───────────────────────────────────────

  const resetAccountState = useCallback((account: TradingAccount) => {
    initialBalRef.current  = null
    digitHistRef.current   = []
    candleBufRef.current   = []
    openContractRef.current = null

    setBalance(account.balance)
    setCurrency(account.currency)
    setProfit(0)
    setWins(0)
    setLosses(0)
    setTrades([])
    setChartData({ barData: [], candleData: [], lastDigit: 0 })
  }, [])

  // ── Trocar de conta ───────────────────────────────────────────────────────

  const switchAccount = useCallback(async (account: TradingAccount) => {
    if (isSwitchingAccount) return
    setIsSwitchingAccount(true)

    try {
      // 1. Parar bot se estiver a correr
      if (botTimerRef.current) {
        clearInterval(botTimerRef.current)
        botTimerRef.current = null
      }
      setBotStatus({ isRunning: false, currentStep: 'idle' })

      // 2. Cancelar contrato aberto
      if (openContractRef.current) {
        try { await derivWs.sellContract(openContractRef.current.contractId, 0) } catch { /* ignora */ }
        openContractRef.current = null
      }

      // 3. Remover todos os listeners
      removeAllListeners()

      // 4. Guardar nova conta activa
      localStorage.setItem('active_account', account.loginid)
      localStorage.setItem('token', account.token)

      // 5. Re-autorizar o WebSocket com o novo token
      await derivWs.authorize(account.token)

      // 6. Actualizar contas disponíveis a partir da resposta de autorização
      //    (o derivWs.authorize deve retornar account_list — ajusta se necessário)
      try {
        const authRes = await derivWs.send({ authorize: account.token }) as Record<string, unknown>
        const authData = authRes.authorize as Record<string, unknown> | undefined

        if (authData?.account_list) {
          const list = authData.account_list as Array<Record<string, unknown>>
          const mapped: TradingAccount[] = list.map(acc => ({
            loginid:                    acc.loginid as string,
            account_type:               acc.is_virtual ? 'demo' : 'real',
            balance:                    (acc.balance as number) ?? 0,
            currency:                   acc.currency as string,
            token:                      acc.token as string,
            is_virtual:                 acc.is_virtual as boolean,
            landing_company_shortcode:  acc.landing_company_shortcode as string | undefined,
          }))
          setAvailableAccounts(mapped)
          localStorage.setItem('trading_accounts', JSON.stringify(mapped))

          // Actualizar saldo real da conta escolhida
          const fresh = mapped.find(a => a.loginid === account.loginid)
          if (fresh) {
            setActiveAccount(fresh)
            resetAccountState(fresh)
          } else {
            setActiveAccount(account)
            resetAccountState(account)
          }
        } else {
          setActiveAccount(account)
          resetAccountState(account)
        }
      } catch {
        // Fallback: usa os dados que já temos
        setActiveAccount(account)
        resetAccountState(account)
      }

      // 7. Re-iniciar subscrições
      await initAccountSubs()
      await initMarketSubs()
      await loadTradeHistory()

    } catch (e) {
      console.error('[Trading] switchAccount falhou:', e)
    } finally {
      setIsSwitchingAccount(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSwitchingAccount, removeAllListeners, resetAccountState])

  // ── Inicializar subscrições de mercado via derivWs ────────────────────────

  const initMarketSubs = useCallback(async () => {
    if (!derivWs.isConnected) return

    // 1. Histórico de candles
    try {
      const res = await derivWs.getTicksHistory(DEFAULT_SYMBOL, MAX_CANDLES, 'candles', 60) as Record<string, unknown>
      const raw = res?.candles as Array<Record<string, number>> | undefined
      if (Array.isArray(raw)) {
        const parsed: CandleData[] = raw.map(c => ({
          x: c.epoch * 1000,
          o: c.open,
          h: c.high,
          l: c.low,
          c: c.close,
        }))
        candleBufRef.current = parsed.slice(-MAX_CANDLES)
        setChartData(prev => ({ ...prev, candleData: candleBufRef.current.slice() }))
      }
    } catch (e) { console.warn('[Trading] ticks_history falhou:', e) }

    // 2. Ticks em tempo real
    try {
      await derivWs.subscribeTicks(DEFAULT_SYMBOL)
    } catch (e) { console.warn('[Trading] subscribeTicks falhou:', e) }

    // 3. Listener de ticks
    const unsubTick = derivWs.on('tick', (raw: unknown) => {
      const msg  = raw as Record<string, unknown>
      const tick = msg.tick as Record<string, unknown> | undefined
      if (!tick) return

      const price = tick.quote as number
      const epoch = tick.epoch as number

      setCurrentPrice(price)
      const digit = getLastDigit(price)
      setLastDigit(digit)

      const hist = digitHistRef.current
      hist.push(digit)
      if (hist.length > MAX_DIGIT_HIST) hist.shift()

      const barData = computeBarData(hist.slice(-selectedTicksRef.current))

      const buf      = candleBufRef.current
      const msNow    = epoch * 1000
      const minStart = Math.floor(msNow / 60_000) * 60_000
      const last     = buf[buf.length - 1]

      if (last && last.x === minStart) {
        last.h = Math.max(last.h, price)
        last.l = Math.min(last.l, price)
        last.c = price
      } else {
        buf.push({ x: minStart, o: price, h: price, l: price, c: price })
        if (buf.length > MAX_CANDLES) buf.shift()
      }

      setChartData({ barData, candleData: buf.slice(), lastDigit: digit })
    })

    unsubsRef.current.push(unsubTick)
  }, [])

  // ── Inicializar subscrições de conta ──────────────────────────────────────

  const initAccountSubs = useCallback(() => {
    if (!derivWs.isConnected) return

    const unsubBal = derivWs.on('balance', (raw: unknown) => {
      const msg = raw as Record<string, unknown>
      const b   = msg.balance as Record<string, unknown> | undefined
      if (!b) return
      const newBal = b.balance as number
      setCurrency((b.currency as string) ?? 'USD')
      setBalance(newBal)
      if (initialBalRef.current === null) initialBalRef.current = newBal
      setProfit(+(newBal - (initialBalRef.current ?? newBal)).toFixed(2))

      // Actualiza saldo na lista de contas disponíveis
      setAvailableAccounts(prev =>
        prev.map(a =>
          a.loginid === (b.loginid as string)
            ? { ...a, balance: newBal }
            : a
        )
      )
    })

    const unsubTx = derivWs.on('transaction', (raw: unknown) => {
      const msg = raw as Record<string, unknown>
      const tx  = msg.transaction as Record<string, unknown> | undefined
      if (!tx) return

      const action = tx.action as string
      if (action !== 'sell') return

      const pnl    = (tx.amount as number) ?? 0
      const epoch  = (tx.transaction_time as number) ?? Math.floor(Date.now() / 1000)
      const trade: Trade = {
        id:         (tx.transaction_id as number) ?? Date.now(),
        hora:       toHora(epoch),
        tipo:       (tx.contract_type as string) ?? action,
        tickFinal:  '—',
        preco:      `$${Math.abs(pnl).toFixed(2)}`,
        resultado:  +pnl.toFixed(2),
        created_at: new Date(epoch * 1000).toISOString(),
      }
      setTrades(prev => [trade, ...prev].slice(0, 500))
      addLocalTrade({
        id:          trade.id as string,
        hora:        trade.hora,
        tipo:        trade.tipo,
        tickFinal:   trade.tickFinal as string,
        preco:       trade.preco,
        resultado:   trade.resultado,
        timestamp:   epoch * 1000,
        contract_id: tx.contract_id as number,
      })
    })

    const unsubPOC = derivWs.on('proposal_open_contract', (raw: unknown) => {
      const msg = raw as Record<string, unknown>
      const poc = msg.proposal_open_contract as Record<string, unknown> | undefined
      if (!poc) return

      if (poc.id && openContractRef.current && !openContractRef.current.subId) {
        openContractRef.current.subId = poc.id as string
      }

      const status = poc.status as string
      const closed = status === 'sold' || status === 'won' || status === 'lost' || !!poc.is_sold
      if (!closed) return

      const pnl    = (poc.profit as number) ?? 0
      const isWin  = pnl >= 0
      const sellP  = ((poc.sell_price ?? poc.bid_price ?? 0) as number)
      const buyP   = ((poc.buy_price ?? 0) as number)
      const epoch  = ((poc.sell_time ?? poc.date_expiry ?? Math.floor(Date.now() / 1000)) as number)
      const exitTick = (poc.exit_tick ?? 0) as number

      const trade: Trade = {
        id:         poc.contract_id as number,
        hora:       toHora(epoch),
        tipo:       (poc.contract_type as string) ?? '—',
        tickFinal:  getLastDigit(exitTick),
        preco:      `$${sellP.toFixed(2)}`,
        resultado:  +pnl.toFixed(2),
        amount:     +buyP.toFixed(2),
        created_at: new Date(((poc.purchase_time as number) ?? epoch) * 1000).toISOString(),
      }

      setTrades(prev => {
        const exists = prev.findIndex(t => t.id === trade.id)
        if (exists >= 0) {
          const next = [...prev]
          next[exists] = trade
          return next
        }
        return [trade, ...prev].slice(0, 500)
      })

      if (isWin) setWins(w => w + 1)
      else       setLosses(l => l + 1)

      if (openContractRef.current?.subId) {
        derivWs.send({ forget: openContractRef.current.subId }).catch(() => {})
      }
      openContractRef.current = null
      setBotStatus(prev => ({ ...prev, currentStep: 'contract_closed' }))

      setTimeout(() => {
        if (mountedRef.current) {
          setBotStatus(prev => prev.isRunning ? { ...prev, currentStep: 'analyzing' } : prev)
        }
      }, 1_200)
    })

    unsubsRef.current.push(unsubBal, unsubTx, unsubPOC)
  }, [])

  // ── Carregar histórico de trades ───────────────────────────────────────────

  const loadTradeHistory = useCallback(async () => {
    setIsLoadingTrades(true)
    try {
      const { data } = await api.getTrades()
      if (Array.isArray(data) && data.length > 0) {
        const mapped: Trade[] = data.map(t => ({
          id:         t.id,
          hora:       t.hora,
          tipo:       t.tipo,
          tickFinal:  t.tickFinal,
          preco:      t.preco,
          resultado:  t.resultado,
          created_at: t.timestamp ? new Date(t.timestamp).toISOString() : undefined,
        }))
        setTrades(mapped)
      }
    } catch (e) {
      console.warn('[Trading] loadTradeHistory falhou:', e)
    } finally {
      setIsLoadingTrades(false)
    }
  }, [])

  // ── Inicializar quando WS fica conectado ──────────────────────────────────

  useEffect(() => {
    mountedRef.current = true

    if (wsConnected) {
      removeAllListeners()
      initAccountSubs()
      initMarketSubs()
      loadTradeHistory()

      // Popular contas disponíveis a partir da autorização inicial
      // O auth-context já autorizou — tentamos obter account_list
      ;(async () => {
        try {
          const res = await derivWs.send({ get_account_status: 1 }) as Record<string, unknown>
          // Se tiveres account_list na resposta de authorize do auth-context,
          // guarda-a lá e lê aqui do localStorage (já feito no useState acima)
          void res
        } catch { /* ignora */ }
      })()
    }

    return () => {
      mountedRef.current = false
      removeAllListeners()
      if (botTimerRef.current) clearInterval(botTimerRef.current)
    }
  }, [wsConnected, initAccountSubs, initMarketSubs, loadTradeHistory, removeAllListeners])

  // Quando a conta muda via auth-context
  useEffect(() => {
    if (currentAccount) {
      initialBalRef.current = null
      setBalance(currentAccount.balance ?? 0)
      setCurrency(currentAccount.currency ?? 'USD')
      setProfit(0)
      setWins(0)
      setLosses(0)
      setTrades([])
      digitHistRef.current  = []
      candleBufRef.current  = []
    }
  }, [currentAccount?.account_id])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Escuta evento global 'account-switch' (disparado pelo AccountSwitcher) ─

  useEffect(() => {
    const handler = (e: Event) => {
      const account = (e as CustomEvent<TradingAccount>).detail
      switchAccount(account)
    }
    window.addEventListener('account-switch', handler)
    return () => window.removeEventListener('account-switch', handler)
  }, [switchAccount])

  // ── Trading ───────────────────────────────────────────────────────────────

  const buyContract = useCallback(async (params: BuyParams) => {
    setBotStatus(prev => ({ ...prev, currentStep: 'analyzing' }))
    try {
      const propRes = await derivWs.getProposal({
        amount:            params.stake,
        basis:             'stake',
        contract_type:     params.contractType,
        currency:          'USD',
        duration:          params.duration,
        duration_unit:     params.durationUnit as 's' | 'm' | 'h' | 'd' | 't',
        underlying_symbol: params.symbol ?? DEFAULT_SYMBOL,
      })
      const proposal   = propRes.proposal
      const proposalId = proposal.id
      const askPrice   = proposal.ask_price

      const buyRes = await derivWs.buyContract(proposalId, askPrice) as Record<string, unknown>
      if (buyRes.error) {
        console.error('[Trading] Erro na compra:', buyRes.error)
        setBotStatus(prev => ({ ...prev, currentStep: 'idle' }))
        return
      }
      const buy        = buyRes.buy as Record<string, unknown>
      const contractId = buy.contract_id as number
      openContractRef.current = { contractId }

      await derivWs.subscribeOpenContract(contractId)
      setBotStatus(prev => ({ ...prev, currentStep: 'contract_open' }))
    } catch (e) {
      console.error('[Trading] buyContract falhou:', e)
      setBotStatus(prev => ({ ...prev, currentStep: 'idle' }))
    }
  }, [])

  const sellContract = useCallback(async (contractId: number) => {
    try {
      await derivWs.sellContract(contractId, 0)
    } catch (e) {
      console.error('[Trading] sellContract falhou:', e)
    }
  }, [])

  // ── Bot automático ────────────────────────────────────────────────────────

  const startBot = useCallback(() => {
    const s = strategyRef.current
    if (!s) return
    setBotStatus({ isRunning: true, currentStep: 'analyzing' })

    const runOnce = () => {
      if (!mountedRef.current || !strategyRef.current) return
      if (openContractRef.current) return
      buyContract({
        contractType: strategyRef.current.contractType,
        duration:     strategyRef.current.duration,
        durationUnit: strategyRef.current.durationUnit,
        stake:        strategyRef.current.stake,
        symbol:       strategyRef.current.symbol,
      })
    }

    runOnce()
    if (botTimerRef.current) clearInterval(botTimerRef.current)
    botTimerRef.current = setInterval(runOnce, 90_000)
  }, [buyContract])

  const stopBot = useCallback(async () => {
    if (botTimerRef.current) { clearInterval(botTimerRef.current); botTimerRef.current = null }
    setBotStatus({ isRunning: false, currentStep: 'idle' })
    if (openContractRef.current) await sellContract(openContractRef.current.contractId)
  }, [sellContract])

  // ── Limpar histórico ──────────────────────────────────────────────────────

  const clearTrades = useCallback(async () => {
    setTrades([])
    setWins(0)
    setLosses(0)
    setProfit(0)
    initialBalRef.current = balance
    clearLocalTrades()
    try { await api.clearTrades() } catch { /* ignora */ }
  }, [balance])

  // ── Value ─────────────────────────────────────────────────────────────────

  const value: TradingContextValue = {
    isConnected: wsConnected,
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
    isLoadingTrades,
    clearTrades,
    strategies,
    currentStrategy,
    setCurrentStrategy,
    botStatus,
    startBot,
    stopBot,
    buyContract,
    sellContract,
    // ── Contas ────────────────────────────────────────────────────────────
    availableAccounts,
    activeAccount,
    isSwitchingAccount,
    switchAccount,
  }

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  )
}
