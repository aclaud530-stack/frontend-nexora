'use client'

import { ReactNode } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { TradingProvider } from '@/lib/trading-context'
import { LoaderProvider } from '@/components/loader'

function TradingProviderWithAuth({ children }: { children: ReactNode }) {
  const { isLoading, currentAccount } = useAuth()

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
      <LoaderProvider>
        <TradingProviderWithAuth>
          {children}
        </TradingProviderWithAuth>
      </LoaderProvider>
    </AuthProvider>
  )
}
