'use client'

import { ReactNode, useMemo } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { TradingProvider } from '@/lib/trading-context'
import { BotsProvider } from '@/lib/bots-context'
import { LoaderProvider } from '@/components/loader'

function TradingProviderWithAuth({ children }: { children: ReactNode }) {
  const { isLoading, currentAccount } = useAuth()

  const { oauthToken, accountId } = useMemo(() => {
    if (isLoading || typeof window === 'undefined') {
      return { oauthToken: '', accountId: '' }
    }
    return {
      oauthToken: localStorage.getItem('token') || '',
      accountId:  currentAccount?.account_id || localStorage.getItem('currentAccountId') || '',
    }
  }, [isLoading, currentAccount?.account_id])

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
          <BotsProvider>
            {children}
          </BotsProvider>
        </TradingProviderWithAuth>
      </LoaderProvider>
    </AuthProvider>
  )
}
