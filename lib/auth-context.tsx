'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { api, Account, derivWs } from './api'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  accounts: Account[]
  currentAccount: Account | null
  setCurrentAccount: (account: Account) => Promise<void>
  logout: () => Promise<void>
  refreshAccounts: () => Promise<void>
  wsConnected: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentAccount, setCurrentAccountState] = useState<Account | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const connecting = useRef(false)

  // ── Ligar WebSocket autenticado via OTP ──────────────────────────────────

  const connectWS = useCallback(async (accountId: string) => {
    if (connecting.current) return
    connecting.current = true

    try {
      // 1. Obter OTP do backend → URL WebSocket autenticado
      const { data } = await api.getOTP(accountId)

      if (!data?.wsUrl) {
        throw new Error('OTP sem wsUrl')
      }

      // 2. Conectar ao WebSocket da Deriv com URL autenticado
      await derivWs.connect(data.wsUrl)
      setWsConnected(true)

      // 3. Subscrever dados em tempo real
      await derivWs.subscribeBalance()
      await derivWs.subscribeTransaction()

      derivWs.on('disconnected', () => setWsConnected(false))

    } catch (error) {
      console.error('[Auth] WS connect failed, tentando público:', error)
      setWsConnected(false)
      // Fallback: WebSocket público para dados de mercado sem autenticação
      try {
        await derivWs.connect()
        setWsConnected(true)
        derivWs.on('disconnected', () => setWsConnected(false))
      } catch {
        console.error('[Auth] Public WS also failed')
      }
    } finally {
      connecting.current = false
    }
  }, [])

  // ── Verificar autenticação ao carregar ──────────────────────────────────

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      // Carregar contas via REST (rápido)
      const { data } = await api.getAccounts()

      if (!data || data.length === 0) {
        throw new Error('Sem contas')
      }

      setAccounts(data)

      const savedId = localStorage.getItem('currentAccountId')
      const active = (savedId && data.find(a => a.account_id === savedId)) || data[0]
      setCurrentAccountState(active || null)
      setIsAuthenticated(true)

      // Ligar WS em paralelo (não bloqueia o UI)
      if (active) {
        connectWS(active.account_id)
      }
    } catch (error) {
      console.error('[Auth] checkAuth failed:', error)
      localStorage.removeItem('token')
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [connectWS])

  useEffect(() => {
    checkAuth()
    return () => { derivWs.disconnect() }
  }, [checkAuth])

  // ── Trocar conta ─────────────────────────────────────────────────────────

  const setCurrentAccount = async (account: Account) => {
    setCurrentAccountState(account)
    localStorage.setItem('currentAccountId', account.account_id)

    try {
      await api.switchAccount(account.account_id)
    } catch (e) {
      console.warn('[Auth] switchAccount REST failed:', e)
    }

    // Reconectar WS com nova conta
    derivWs.disconnect()
    setWsConnected(false)
    await connectWS(account.account_id)
  }

  // ── Logout ───────────────────────────────────────────────────────────────

  const logout = async () => {
    derivWs.disconnect()
    setWsConnected(false)
    await api.logout()
    setIsAuthenticated(false)
    setAccounts([])
    setCurrentAccountState(null)
    window.location.href = '/'
  }

  // ── Refrescar contas ─────────────────────────────────────────────────────

  const refreshAccounts = async () => {
    try {
      const { data } = await api.getAccounts()
      setAccounts(data)
      if (currentAccount) {
        const updated = data.find(a => a.account_id === currentAccount.account_id)
        if (updated) setCurrentAccountState(updated)
      }
    } catch (e) {
      console.error('[Auth] refreshAccounts failed:', e)
    }
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      accounts,
      currentAccount,
      setCurrentAccount,
      logout,
      refreshAccounts,
      wsConnected,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
