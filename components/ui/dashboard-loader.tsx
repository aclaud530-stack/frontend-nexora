'use client'

import { cn } from '@/lib/utils'

interface DashboardLoaderProps {
  message?: string
  className?: string
}

export function DashboardLoader({ message = 'A carregar...', className }: DashboardLoaderProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm',
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Spinner animado */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
        </div>

        {/* Mensagem */}
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      </div>
    </div>
  )
}

interface AccountSwitchLoaderProps {
  accountType: 'real' | 'demo'
}

export function AccountSwitchLoader({ accountType }: AccountSwitchLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-xl bg-card p-8 shadow-lg border border-border">
        {/* Spinner */}
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
        </div>

        {/* Texto */}
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            A mudar para {accountType === 'real' ? 'Conta Real' : 'Conta Demo'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Aguarde um momento...
          </p>
        </div>
      </div>
    </div>
  )
}
