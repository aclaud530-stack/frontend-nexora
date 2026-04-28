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

  const connectWS = useCallback(async (accountId: string) => {
    if (connecting.current) return
    connecting.current = true

    try {
      const { data } = await api.getOTP(accountId)

      if (!data?.wsUrl) throw new Error('OTP sem wsUrl')

      await derivWs.connect(data.wsUrl)
      setWsConnected(true)

      await derivWs.subscribeBalance()
      await derivWs.subscribeTransaction()

      derivWs.on('disconnected', () => setWsConnected(false))

    } catch (error) {
      console.error('[Auth] WS connect failed, tentando público:', error)
      setWsConnected(false)
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

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      const { data } = await api.getAccounts()

      if (!data || data.length === 0) {
        setIsAuthenticated(true)
        setIsLoading(false)
        return
      }

      setAccounts(data)
      const savedId = localStorage.getItem('currentAccountId')
      const active = (savedId && data.find(a => a.account_id === savedId)) || data[0]
      setCurrentAccountState(active || null)
      setIsAuthenticated(true)

      if (active) connectWS(active.account_id)

    } catch (error) {
      console.error('[Auth] checkAuth failed:', error)

      const msg = error instanceof Error ? error.message : ''
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        localStorage.removeItem('token')
        setIsAuthenticated(false)
      } else {
        // Erro de rede/backend — mantém autenticado
        setIsAuthenticated(true)
      }
    } finally {
      setIsLoading(false)
    }
  }, [connectWS])

  useEffect(() => {
    checkAuth()
    return () => { derivWs.disconnect() }
  }, [checkAuth])

  const setCurrentAccount = async (account: Account) => {
    setCurrentAccountState(account)
    localStorage.setItem('currentAccountId', account.account_id)

    try {
      await api.switchAccount(account.account_id)
    } catch (e) {
      console.warn('[Auth] switchAccount REST failed:', e)
    }

    derivWs.disconnect()
    setWsConnected(false)
    await connectWS(account.account_id)
  }

  const logout = async () => {
    derivWs.disconnect()
    setWsConnected(false)
    await api.logout()
    setIsAuthenticated(false)
    setAccounts([])
    setCurrentAccountState(null)
    window.location.href = '/'
  }

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
