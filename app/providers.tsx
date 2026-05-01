'use client'

/**
 * providers.tsx
 *
 * Liga o TradingProvider ao AuthContext:
 * - Aguarda que a autenticação esteja pronta
 * - Passa o token e accountId diretamente ao TradingProvider
 * - Evita que o WS conecte com credenciais vazias
 */

import { ReactNode } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { TradingProvider } from '@/lib/trading-context'

// Componente interno que lê o auth e passa ao TradingProvider
function TradingProviderWithAuth({ children }: { children: ReactNode }) {
  const { isLoading, currentAccount } = useAuth()

  // Aguarda o auth-context terminar — evita conectar WS com credenciais vazias
  if (isLoading) return <>{children}</>

  const oauthToken = localStorage.getItem('token') || ''
  const accountId  = currentAccount?.account_id
                  || localStorage.getItem('currentAccountId')
                  || ''

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
