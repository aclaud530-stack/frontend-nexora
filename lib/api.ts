'use client'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://banckend-production-14a1.up.railway.app'
const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || '3356rGdzrsnQaEKsg8MMA'

export interface Account {
  id: string
  account_id: string
  loginid: string
  full_name?: string
  name?: string
  balance: number | string
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

// Rótulos de exibição para os tipos de conta. Só texto — nunca troca
// qual conta é "real" e qual é "demo" (isso vem sempre de is_virtual/
// account_type da Deriv). Configurável apenas por admins, via
// /api/admin/labels, persistido no backend (Redis).
export interface AccountLabels {
  realLabel: string
  demoLabel: string
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
    const raw = res?.data?.accounts || res?.data || []
    const accounts: Account[] = Array.isArray(raw)
      ? raw.map((a: Account) => ({
          ...a,
          balance: Number(a.balance ?? 0),
          // ✅ garante is_virtual mesmo que o backend não envie o campo
          is_virtual: a.is_virtual ?? a.account_type === 'demo',
        }))
      : []
    return { data: accounts }
  },

  // ✅ switchAccount removido — não existe endpoint na API Deriv.
  // A troca de conta é feita via novo OTP no trading-context.
  async switchAccount(_accountId: string): Promise<{ success: boolean }> {
    return { success: true }
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

  // ── Rótulos de exibição das contas (Real/Demo) ────────────────────────────
  // Só texto de exibição — nunca altera qual conta é realmente real ou
  // demo. Leitura disponível a qualquer utilizador; escrita só a admins
  // (validado no backend via x-cr contra ADMIN_ACCOUNT_IDS).

  async getAccountLabels(): Promise<AccountLabels> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/labels`)
      return res.json()
    } catch {
      return { realLabel: 'Real', demoLabel: 'Demo' }
    }
  },

  async setAccountLabels(accountId: string, labels: Partial<AccountLabels>): Promise<AccountLabels> {
    const res = await fetch(`${API_BASE_URL}/api/admin/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
        'x-cr': accountId,
      },
      body: JSON.stringify(labels),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
}
