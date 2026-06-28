'use client'
import { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { AuthProvider } from '@/lib/auth-context'
import { TradingProvider } from '@/lib/trading-context'
import { LoaderProvider } from '@/components/loader'

// BotsProvider só no cliente — contém WebSocket
const BotsProvider = dynamic(
  () => import('@/lib/bots-context').then(m => ({ default: m.BotsProvider })),
  { ssr: false }
)

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LoaderProvider>
        <TradingProvider>
          <BotsProvider>
            {children}
          </BotsProvider>
        </TradingProvider>
      </LoaderProvider>
    </AuthProvider>
  )
}
