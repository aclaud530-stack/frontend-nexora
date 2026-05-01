'use client'

import { ReactNode } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { TradingProvider } from '@/lib/trading-context'

function TradingProviderWithAuth({ children }: { children: ReactNode }) {
  const { isLoading, currentAccount } = useAuth()

  // ✅ TradingProvider é SEMPRE montado — evita o erro "useTrading fora do provider"
  // Durante o loading (SSR ou auth a carregar) passa strings vazias → WS usa modo público
  // Quando o auth termina, passa as credenciais reais → WS reconecta autenticado

  const oauthToken =
    !isLoading && typeof window !== 'undefined'
      ? localStorage.getItem('token') || ''
      : ''

  const accountId =
    !isLoading && typeof window !== 'undefined'
      ? currentAccount?.account_id || localStorage.getItem('currentAccountId') || ''
      : ''

  return (
    <TradingProvider oauthToken={oauthToken} accountId={accountId}>
      {children}
    </TradingProvider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TradingProviderWithAuth>
        {children}
      </TradingProviderWithAuth>
    </AuthProvider>
  )
}
