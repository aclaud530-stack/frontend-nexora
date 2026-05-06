'use client'

import { useEffect, useState } from 'react'
import { useRouter }        from 'next/navigation'
import { ChartSection }     from '@/components/dashboard/chart-section'
import { BalanceCard }      from '@/components/dashboard/balance-card'
import { ControlsSection }  from '@/components/dashboard/controls-section'
import { TradesTable }      from '@/components/dashboard/trades-table'
import { BotsPanel }        from '@/components/bots/bots-panel'
import { Footer }           from '@/components/dashboard/footer'
import { useAuth }          from '@/lib/auth-context'
import { useLoader }        from '@/components/loader'
import { useTrading }       from '@/lib/trading-context'

// ── Ícones de tab ─────────────────────────────────────────────────────────────

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
      stroke={active ? '#2ec7ff' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 16l5-5 4 4 7-9" />
    </svg>
  )
}

function BotIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#2ec7ff' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <line x1="12" y1="7" x2="12" y2="11" />
      <line x1="8" y1="15" x2="8" y2="17" />
      <line x1="16" y1="15" x2="16" y2="17" />
    </svg>
  )
}

// ── Loader ────────────────────────────────────────────────────────────────────

function DashboardLoader() {
  const [dots, setDots] = useState('')
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-[#060a18]/95 backdrop-blur-md">
      <div className="text-[18px] font-black tracking-[5px] select-none"
        style={{
          fontFamily: 'Orbitron, system-ui, sans-serif',
          background: 'linear-gradient(135deg, #fff 0%, #2ec7ff 50%, #fff 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
        NEXORA FOREX
      </div>
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full animate-spin"
          style={{ border: '2px solid transparent', borderTopColor: '#2ec7ff', borderRightColor: 'rgba(46,199,255,0.15)', animationDuration: '0.85s' }} />
        <div className="absolute inset-[9px] rounded-full animate-spin"
          style={{ border: '2px solid transparent', borderBottomColor: '#0077ff', borderLeftColor: 'rgba(0,119,255,0.15)', animationDuration: '0.65s', animationDirection: 'reverse' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#2ec7ff', boxShadow: '0 0 12px #2ec7ff' }} />
        </div>
      </div>
      <div className="w-36 h-[2px] bg-[#0e1525] rounded overflow-hidden">
        <div className="h-full rounded" style={{
          background: 'linear-gradient(90deg, #0077ff, #2ec7ff)',
          boxShadow: '0 0 8px rgba(46,199,255,0.5)',
          animation: 'dashboardLoadBar 1.4s ease-in-out infinite',
        }} />
      </div>
      <p className="text-[11px] font-medium tracking-[2px] uppercase text-[#3b4a6b]"
        style={{ fontFamily: 'Inter, sans-serif' }}>
        A carregar{dots}
      </p>
      <style>{`
        @keyframes dashboardLoadBar {
          0%   { width: 0%;  margin-left: 0%; }
          50%  { width: 70%; margin-left: 15%; }
          100% { width: 0%;  margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}

// ── Tabs do painel lateral ────────────────────────────────────────────────────

type PanelTab = 'trades' | 'bots'

function PanelTabs({ active, onChange, botsCount }: {
  active:   PanelTab
  onChange: (t: PanelTab) => void
  botsCount: number
}) {
  return (
    <div className="flex items-center gap-1 border-b border-[#1a1f2e] shrink-0 px-4 pt-1">
      {(['trades', 'bots'] as PanelTab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
            active === tab
              ? 'border-[#2ec7ff] text-[#2ec7ff]'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          {tab === 'trades'
            ? <><ChartIcon active={active === tab} /> Trades</>
            : <><BotIcon   active={active === tab} /> Bots {botsCount > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${active === tab ? 'bg-[#2ec7ff]/20 text-[#2ec7ff]' : 'bg-[#2a3142] text-gray-400'}`}>{botsCount}</span>}</>
          }
        </button>
      ))}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function TradingDashboard() {
  const router                              = useRouter()
  const { isLoading: authLoading }          = useAuth()
  const { isConnected, loading: tradingLoading } = useTrading()
  const { show, complete }                  = useLoader()

  const [desktopTab, setDesktopTab] = useState<PanelTab>('trades')
  const [mobileTab,  setMobileTab]  = useState<PanelTab>('trades')
  const [botsCount,  setBotsCount]  = useState(0)   // actualizado pelo BotsPanel via contexto

  const showLoader = authLoading || tradingLoading

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { show('A redirecionar...'); router.push('/'); return }
    if (!authLoading) complete('Pronto!')
  }, [authLoading, router, show, complete])

  // Importar useBots apenas para o contador de bots
  // (o BotsProvider está no providers.tsx)
  useEffect(() => {
    // Actualizar o botsCount através do evento de storage
    // Alternativa simples: o BotsPanel chama um callback
  }, [])

  if (authLoading) return <DashboardLoader />

  return (
    <div className="h-screen h-dvh bg-[#0a0e1a] text-white flex flex-col overflow-hidden">
      {showLoader && !authLoading && <DashboardLoader />}

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0e1a] border-b border-[#1a1f2e] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-lg font-black tracking-[3px]"
            style={{
              fontFamily: 'Orbitron, system-ui, sans-serif',
              background: 'linear-gradient(135deg, #fff, #2ec7ff, #fff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
            NEXORA FOREX
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${isConnected ? 'bg-[#22c55e] animate-pulse' : 'bg-[#ef4444]'}`} />
            <span className={`text-[9px] font-medium tracking-wide uppercase hidden sm:inline ${isConnected ? 'text-gray-600' : 'text-[#ef4444]'}`}>
              {isConnected ? 'live' : 'offline'}
            </span>
          </div>
        </div>
        <button onClick={() => { show('A carregar...'); router.push('/menu') }}
          className="text-[#22c55e] font-bold text-xs sm:text-base tracking-wide hover:text-[#2ec7ff] transition-colors">
          MENU
        </button>
      </header>

      {/* ── Desktop Layout ── */}
      <main className="hidden lg:flex flex-1 min-h-0">

        {/* Coluna esquerda — gráfico + controlos */}
        <div className="flex-1 flex flex-col p-4 xl:p-5 gap-4 overflow-y-auto">
          <ChartSection />
          <BalanceCard />
          <ControlsSection />
          <Footer />
        </div>

        {/* Coluna direita — tabs Trades / Bots */}
        <div className="w-[380px] xl:w-[450px] 2xl:w-[500px] flex flex-col border-l-2 border-[#1a1f2e]">
          <PanelTabs active={desktopTab} onChange={setDesktopTab} botsCount={botsCount} />

          <div className="flex-1 min-h-0 overflow-hidden">
            {desktopTab === 'trades' ? (
              <TradesTable />
            ) : (
              <div className="h-full overflow-y-auto p-4">
                <BotsPanel onBotsCountChange={setBotsCount} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Mobile Layout ── */}
      <main className="lg:hidden flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Tabs no topo — mobile */}
        <div className="shrink-0">
          <PanelTabs active={mobileTab} onChange={setMobileTab} botsCount={botsCount} />
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5 sm:space-y-3">
          <ChartSection />
          <BalanceCard />
          <ControlsSection />

          {mobileTab === 'trades' ? (
            <div className="min-h-[200px] max-h-[300px] sm:max-h-[350px]">
              <TradesTable />
            </div>
          ) : (
            <BotsPanel onBotsCountChange={setBotsCount} />
          )}

          <Footer />
        </div>
      </main>
    </div>
  )
}
