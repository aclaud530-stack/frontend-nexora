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
  // ── NOVO: login explícito chamado pelo /callback ──────────
  // Em vez de depender do useEffect inicial reler o localStorage
  // (que falha se correr antes do /callback gravar o token —
  // causa da "falha ao autenticar, preciso recarregar a página"),
  // o /callback chama isto directamente com o token que acabou
  // de receber. Fluxo síncrono e explícito, sem race condition,
  // e sem duplicar chamadas de rede a getAccounts().
  login: (token: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentAccount, setCurrentAccountState] = useState<Account | null>(null)
  const initialCheckDone = useRef(false)

  // Núcleo partilhado: busca contas, define currentAccount a partir
  // do localStorage ou da primeira conta disponível, marca autenticado.
  // Usado tanto pelo checkAuth (mount normal) como pelo login (callback OAuth).
  const loadAccounts = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await api.getAccounts()
      if (!data || data.length === 0) {
        setIsAuthenticated(true)
        return true
      }
      setAccounts(data)
      const savedId = localStorage.getItem('currentAccountId')
      const active = (savedId && data.find(a => a.account_id === savedId)) || data[0]
      setCurrentAccountState(active || null)
      if (active) localStorage.setItem('currentAccountId', active.account_id)
      setIsAuthenticated(true)
      return true
    } catch (error) {
      console.error('[Auth] loadAccounts failed:', error)
      const msg = error instanceof Error ? error.message : ''
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        localStorage.removeItem('token')
        setIsAuthenticated(false)
        return false
      }
      // Erro de rede/backend — mantém autenticado, tenta de novo depois
      setIsAuthenticated(true)
      return true
    }
  }, [])

  const checkAuth = useCallback(async () => {
    if (initialCheckDone.current) return
    initialCheckDone.current = true
    const token = localStorage.getItem('token')
    if (!token) {
      setIsLoading(false)
      return
    }
    await loadAccounts()
    setIsLoading(false)
  }, [loadAccounts])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // ── login() ────────────────────────────────────────────────
  // Chamado pelo /callback imediatamente após gravar o token.
  // Marca o check inicial como "feito" para o useEffect de mount
  // não correr a destempo, e popula accounts/currentAccount de
  // forma síncrona com o resultado — sem esperar por um segundo
  // ciclo de useEffect. Devolve true/false para o callback decidir
  // quando é seguro navegar para /dashboard.
  const login = useCallback(async (token: string): Promise<boolean> => {
    initialCheckDone.current = true // impede o checkAuth do mount de correr com token vazio
    localStorage.setItem('token', token)
    setIsLoading(true)
    const ok = await loadAccounts()
    setIsLoading(false)
    return ok
  }, [loadAccounts])

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
      login,
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
