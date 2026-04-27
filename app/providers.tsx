'use client'

import { ReactNode } from 'react'
import { LoaderProvider } from '@/components/loader'
import { AuthProvider } from '@/lib/auth-context'
import { TradingProvider } from '@/lib/trading-context'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LoaderProvider>
      <AuthProvider>
        <TradingProvider>
          {children}
        </TradingProvider>
      </AuthProvider>
    </LoaderProvider>
  )
}
