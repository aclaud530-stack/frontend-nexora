'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChartSection } from '@/components/dashboard/chart-section'
import { BalanceCard } from '@/components/dashboard/balance-card'
import { ControlsSection } from '@/components/dashboard/controls-section'
import { TradesTable } from '@/components/dashboard/trades-table'
import { Footer } from '@/components/dashboard/footer'
import { useAuth } from '@/lib/auth-context'
import { useLoader } from '@/components/loader'

export default function TradingDashboard() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { show, complete } = useLoader()
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Verificar autenticação
    const token = localStorage.getItem('token')
    if (!token && !authLoading) {
      show('A redirecionar...')
      router.push('/')
      return
    }

    if (!authLoading && isAuthenticated) {
      complete('Pronto!')
      setIsLoaded(true)
    }
  }, [authLoading, isAuthenticated, router, show, complete])

  const handleMenuClick = () => {
    show('A carregar...')
    router.push('/menu')
  }

  if (authLoading || !isLoaded) {
    return (
      <div className="h-screen h-dvh bg-[#0a0e1a] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#2ec7ff] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className={`h-screen h-dvh bg-[#0a0e1a] text-white flex flex-col overflow-hidden transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0e1a] border-b border-[#1a1f2e] shrink-0">
        <div className="flex items-center gap-2">
          <span 
            className="text-sm sm:text-lg font-black tracking-[3px]"
            style={{ 
              fontFamily: 'Orbitron, system-ui, sans-serif',
              background: 'linear-gradient(135deg, #fff, #2ec7ff, #fff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            NEXORA
          </span>
        </div>
        <button 
          onClick={handleMenuClick}
          className="text-[#22c55e] font-bold text-xs sm:text-base tracking-wide hover:text-[#2ec7ff] transition-colors"
        >
          MENU
        </button>
      </header>

      {/* Desktop Layout: 2 colunas lado a lado */}
      <main className="hidden lg:flex flex-1 min-h-0">
        {/* Coluna Esquerda - Gráficos e Controles */}
        <div className="flex-1 flex flex-col p-4 xl:p-5 gap-4 overflow-y-auto">
          <ChartSection />
          <BalanceCard />
          <ControlsSection />
          <Footer />
        </div>

        {/* Coluna Direita - Histórico */}
        <div className="w-[380px] xl:w-[450px] 2xl:w-[500px] flex flex-col p-4 xl:p-5 border-l-2 border-[#1a1f2e]">
          <div className="flex-1 min-h-0">
            <TradesTable />
          </div>
        </div>
      </main>

      {/* Mobile/Tablet Layout: coluna única */}
      <main className="lg:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Container com scroll para todo conteúdo mobile */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5 sm:space-y-3">
          {/* Gráfico */}
          <ChartSection />
          
          {/* Saldo */}
          <BalanceCard />
          
          {/* Controles */}
          <ControlsSection />
          
          {/* Tabela de trades */}
          <div className="min-h-[200px] max-h-[300px] sm:max-h-[350px]">
            <TradesTable />
          </div>
          
          {/* Footer */}
          <Footer />
        </div>
      </main>
    </div>
  )
}
