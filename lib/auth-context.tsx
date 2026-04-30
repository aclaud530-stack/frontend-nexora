'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { api, Account } from './api'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  accounts: Account[]
  currentAccount: Account | null
  setCurrentAccount: (account: Account) => Promise<void>
  logout: () => Promise<void>
  refreshAccounts: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentAccount, setCurrentAccountState] = useState<Account | null>(null)
  const initialCheckDone = useRef(false)

  const checkAuth = useCallback(async () => {
    if (initialCheckDone.current) return
    initialCheckDone.current = true

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
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const setCurrentAccount = async (account: Account) => {
    setCurrentAccountState(account)
    localStorage.setItem('currentAccountId', account.account_id)

    try {
      await api.switchAccount(account.account_id)
    } catch (e) {
      console.warn('[Auth] switchAccount REST failed:', e)
    }
  }

  const logout = async () => {
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
