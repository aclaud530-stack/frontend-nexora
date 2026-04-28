'use client'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://banckend-production-14a1.up.railway.app'
const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || '3356rGdzrsnQaEKsg8MMA'

export interface Account {
  id: string
  account_id: string
  loginid: string
  full_name?: string
  name?: string
  balance: number
  currency: string
  is_virtual: boolean
  account_type: 'demo' | 'real'
  status?: string
  group?: string
}

export interface Strategy {
  id: string
  name: string
  description?: string
  isActive: boolean
}

export interface Trade {
  id: string
  hora: string
  tipo: string
  tickFinal: string
  preco: string
  resultado: number
  timestamp: number
  contract_id?: number
  contract_type?: string
}

export interface BotStatus {
  isRunning: boolean
  currentStep: 'analyzing' | 'contract_open' | 'contract_closed' | 'idle'
  progress: number
}

export interface CandleData {
  x: number
  o: number
  h: number
  l: number
  c: number
}

export interface ChartData {
  lastDigit: number
  ticks: number
  barData: Array<{ digit: number; percentage: number; isHighlight: boolean; isLow: boolean }>
  candleData: CandleData[]
  lineData: Array<{ x: number; y: number; timestamp: number }>
}

export interface BalanceData {
  balance: number
  currency: string
  loginid: string
}

export interface TickData {
  ask?: number
  bid?: number
  epoch: number
  quote: number
  symbol: string
}

export interface ProposalData {
  id: string
  ask_price: number
  payout: number
  spot: number
  spot_time: number
  longcode: string
}

function getToken(): string | null {
  if (typeof window !== 'undefined') return localStorage.getItem('token')
  return null
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getToken()
  const customHeaders = (options.headers as Record<string, string>) || {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Deriv-App-ID': DERIV_APP_ID,
    ...customHeaders,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers })

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/'
    }
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || err.error || `HTTP ${response.status}`)
  }
  return response.json()
}

// Estratégias locais — não existem no backend
const LOCAL_STRATEGIES: Strategy[] = [
  { id: '1', name: 'Gpt5.4', description: 'Estratégia principal', isActive: true },
  { id: '2', name: 'Martingale Pro', description: 'Estratégia de recuperação', isActive: false },
  { id: '3', name: 'Scalper V2', description: 'Trades rápidos', isActive: false },
]

// Trades em memória — alimentados pelo WebSocket
let localTrades: Trade[] = []

export function addLocalTrade(trade: Trade) {
  localTrades = [trade, ...localTrades].slice(0, 100)
}

export function clearLocalTrades() {
  localTrades = []
}

export const api = {
  async exchangeToken(code: string, codeVerifier: string, redirectUri: string): Promise<{ accessToken: string; expiresIn: number; userId: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || data.message || 'Token exchange failed')
    return data.data
  },

  async validateToken(): Promise<{ valid: boolean }> {
    try {
      return await fetchWithAuth('/api/auth/validate')
    } catch {
      return { valid: false }
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      })
    } catch (e) {
      console.error('[API] Logout error:', e)
    } finally {
      if (typeof window !== 'undefined') { localStorage.clear(); sessionStorage.clear() }
    }
  },

  async getAccounts(): Promise<{ data: Account[] }> {
    const res = await fetchWithAuth('/api/accounts')
    const accounts = res?.data?.accounts || res?.data || []
    return { data: Array.isArray(accounts) ? accounts : [] }
  },

  async switchAccount(accountId: string): Promise<{ success: boolean }> {
    try {
      return await fetchWithAuth('/api/accounts/switch', {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId }),
      })
    } catch {
      return { success: true }
    }
  },

  async getOTP(accountId: string): Promise<{ data: { wsUrl: string } }> {
    const res = await fetchWithAuth(`/api/accounts/${accountId}/otp`, { method: 'POST' })
    const wsUrl = res?.data?.wsUrl || res?.data?.url || res?.wsUrl || res?.url
    return { data: { wsUrl } }
  },

  async resetDemoBalance(accountId: string): Promise<{ data: Account }> {
    return fetchWithAuth(`/api/accounts/${accountId}/reset`, { method: 'POST' })
  },

  // ── Estratégias locais (sem backend) ──────────────────────────────────────
  async getStrategies(): Promise<{ data: Strategy[] }> {
    return { data: LOCAL_STRATEGIES }
  },

  async setStrategy(strategyId: string): Promise<{ success: boolean }> {
    LOCAL_STRATEGIES.forEach(s => s.isActive = s.id === strategyId)
    return { success: true }
  },

  // ── Bot — estado local, operações via WebSocket ───────────────────────────
  async startBot(): Promise<{ success: boolean; status: BotStatus }> {
    return { success: true, status: { isRunning: true, currentStep: 'analyzing', progress: 0 } }
  },

  async stopBot(): Promise<{ success: boolean; status: BotStatus }> {
    return { success: true, status: { isRunning: false, currentStep: 'idle', progress: 0 } }
  },

  async getBotStatus(): Promise<BotStatus> {
    return { isRunning: false, currentStep: 'idle', progress: 0 }
  },

  // ── Trades — alimentados pelo WebSocket, guardados em memória ─────────────
  async getTrades(): Promise<{ data: Trade[] }> {
    return { data: localTrades }
  },

  async clearTrades(): Promise<{ success: boolean }> {
    clearLocalTrades()
    return { success: true }
  },

  // ── Chart — dados vêm do WebSocket (ticks + candles) ─────────────────────
  async getChartData(ticks: number): Promise<ChartData> {
    return {
      lastDigit: 0,
      ticks,
      barData: Array.from({ length: 10 }, (_, i) => ({
        digit: i,
        percentage: 10,
        isHighlight: false,
        isLow: false,
      })),
      candleData: [],
      lineData: [],
    }
  },

  async getOnlineCount(): Promise<{ count: number }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/online-count`)
      return res.json()
    } catch {
      return { count: 0 }
    }
  },

  async checkAdmin(accountId: string): Promise<{ isAdmin: boolean }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/check`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'x-cr': accountId,
        },
      })
      return res.json()
    } catch {
      return { isAdmin: false }
    }
  },
}

// ── WebSocket ────────────────────────────────────────────────────────────────

type MessageHandler = (data: unknown) => void

export class DerivWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private listeners: Map<string, Set<MessageHandler>> = new Map()
  private reqIdCounter = 0
  private pendingRequests: Map<number, { resolve: (d: unknown) => void; reject: (e: Error) => void }> = new Map()
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private currentWsUrl: string | null = null

  async connect(wsUrl?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null }

      const url = wsUrl || 'wss://api.derivws.com/trading/v1/options/ws/public'
      this.currentWsUrl = wsUrl || null

      this.ws = new WebSocket(url)
      const timeout = setTimeout(() => reject(new Error('WS timeout')), 15000)

      this.ws.onopen = () => {
        clearTimeout(timeout)
        this.reconnectAttempts = 0
        this.startPing()
        resolve()
      }

      this.ws.onmessage = (event) => {
        try { this.handleMessage(JSON.parse(event.data)) }
        catch (e) { console.error('[WS] Parse error:', e) }
      }

      this.ws.onclose = (event) => {
        clearTimeout(timeout)
        this.stopPing()
        this.emit('disconnected', {})
        if (event.code !== 1000) this.tryReconnect()
      }

      this.ws.onerror = (error) => { clearTimeout(timeout); reject(error) }
    })
  }

  private handleMessage(message: Record<string, unknown>) {
    const msgType = (message.msg_type || message.type) as string | undefined
    const reqId = message.req_id as number | undefined

    if (reqId !== undefined && this.pendingRequests.has(reqId)) {
      const { resolve, reject } = this.pendingRequests.get(reqId)!
      this.pendingRequests.delete(reqId)
      if (message.error) reject(new Error((message.error as { message?: string })?.message || 'Unknown'))
      else resolve(message)
    }

    if (msgType) this.listeners.get(msgType)?.forEach(cb => cb(message))
    this.listeners.get('all')?.forEach(cb => cb(message))
  }

  private emit(type: string, data: unknown) { this.listeners.get(type)?.forEach(cb => cb(data)) }

  private startPing() {
    this.stopPing()
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ ping: 1 }))
    }, 30000)
  }

  private stopPing() {
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null }
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    setTimeout(() => this.connect(this.currentWsUrl || undefined).catch(() => {}), delay)
  }

  send(data: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState !== WebSocket.OPEN) { reject(new Error('WS not connected')); return }
      const reqId = ++this.reqIdCounter
      this.pendingRequests.set(reqId, { resolve, reject })
      this.ws.send(JSON.stringify({ ...data, req_id: reqId }))
      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) { this.pendingRequests.delete(reqId); reject(new Error('Request timeout')) }
      }, 30000)
    })
  }

  on(type: string, callback: MessageHandler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(callback)
    return () => this.listeners.get(type)?.delete(callback)
  }

  off(type: string, callback: MessageHandler) { this.listeners.get(type)?.delete(callback) }

  async subscribeBalance(): Promise<void> { await this.send({ balance: 1, subscribe: 1 }) }
  async subscribeTransaction(): Promise<void> { await this.send({ transaction: 1, subscribe: 1 }) }
  async subscribeTicks(symbol: string): Promise<void> { await this.send({ ticks: symbol, subscribe: 1 }) }

  async getTicksHistory(symbol: string, count = 60, style: 'ticks' | 'candles' = 'candles', granularity = 60): Promise<unknown> {
    return this.send({ ticks_history: symbol, end: 'latest', count, style, granularity })
  }

  async getProposal(params: {
    amount: number
    basis: 'stake' | 'payout'
    contract_type: string
    currency: string
    duration: number
    duration_unit: 's' | 'm' | 'h' | 'd' | 't'
    underlying_symbol: string
    subscribe?: boolean
  }): Promise<{ proposal: ProposalData }> {
    return this.send({ proposal: 1, ...params, subscribe: params.subscribe ? 1 : 0 }) as Promise<{ proposal: ProposalData }>
  }

  async buyContract(proposalId: string, price: number): Promise<unknown> {
    return this.send({ buy: proposalId, price })
  }

  async sellContract(contractId: number, price: number): Promise<unknown> {
    return this.send({ sell: contractId, price })
  }

  async subscribeOpenContract(contractId: number): Promise<void> {
    await this.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 })
  }

  async forgetAll(types: string[]): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) await this.send({ forget_all: types }).catch(() => {})
  }

  disconnect() {
    this.stopPing()
    this.forgetAll(['ticks', 'proposal', 'balance', 'transaction', 'proposal_open_contract'])
      .finally(() => { this.ws?.close(1000, 'Intentional'); this.ws = null })
    this.listeners.clear()
    this.pendingRequests.clear()
    this.currentWsUrl = null
  }

  get isConnected(): boolean { return this.ws?.readyState === WebSocket.OPEN }
}

export const derivWs = new DerivWebSocket()
