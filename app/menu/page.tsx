'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useLoader } from '@/components/loader'
import { api } from '@/lib/api'
import {
  X,
  Globe,
  LayoutDashboard,
  Bot,
  Landmark,
  MessageCircle,
  Link2,
  Bell,
  GraduationCap,
  Gem,
  DownloadCloud,
  FileText,
  User,
  ShieldCheck,
  BarChart2,
  ChevronRight,
  LogOut,
  ExternalLink,
  ChevronDown,
} from 'lucide-react'

const WHATSAPP = '976289984'

function generateOnlineCount() {
  const base = 4890899
  return base + Math.floor(Math.random() * 50000)
}

const LOCAL_AVISOS = [
  {
    id: '1',
    titulo: 'Manutenção programada',
    mensagem: 'O sistema estará em manutenção no dia 30/04 das 02h às 04h.',
    data: '28/04/2026',
  },
  {
    id: '2',
    titulo: 'Nova estratégia disponível',
    mensagem: 'A estratégia Gpt5.4 foi atualizada com melhorias de precisão.',
    data: '27/04/2026',
  },
  {
    id: '3',
    titulo: 'Promoção Mentoria VIP',
    mensagem: 'Vagas limitadas para mentoria VIP de maio. Entre em contacto agora.',
    data: '25/04/2026',
  },
]

const TERMOS_PLATAFORMA = `TERMOS E CONDIÇÕES — NEXORA FOREX

1. ACEITAÇÃO DOS TERMOS
Ao utilizar a plataforma Nexora Forex, o utilizador aceita integralmente os presentes termos e condições.

2. DESCRIÇÃO DO SERVIÇO
A Nexora Forex é uma plataforma de apoio ao trading que opera em conjunto com a corretora Deriv. Não somos uma corretora e não detemos fundos dos utilizadores.

3. RISCOS
O trading envolve riscos elevados de perda de capital. Os resultados passados não garantem resultados futuros. O utilizador é o único responsável pelas suas decisões de investimento.

4. RESPONSABILIDADE
A Nexora Forex não se responsabiliza por perdas financeiras resultantes do uso da plataforma ou das estratégias disponibilizadas.

5. PRIVACIDADE
Os dados do utilizador são tratados de forma confidencial e não são partilhados com terceiros sem consentimento, exceto quando exigido por lei.

6. ALTERAÇÕES
Reservamo-nos o direito de alterar estes termos a qualquer momento, com aviso prévio aos utilizadores.

7. CONTACTO
Para questões, contacte-nos via WhatsApp: +${WHATSAPP}`

export default function MenuPage() {
  const router = useRouter()
  const { currentAccount, logout } = useAuth()
  const { show, complete, hide } = useLoader()
  const [onlineCount, setOnlineCount] = useState(generateOnlineCount())
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [avisosOpen, setAvisosOpen] = useState(false)
  const [termosOpen, setTermosOpen] = useState(false)
  const [termosTab, setTermosTab] = useState<'plataforma' | 'deriv'>('plataforma')
  const unreadAvisos = LOCAL_AVISOS.length

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount(generateOnlineCount())
    }, 7 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/'); return }
    loadData()
  }, [])

  const loadData = async () => {
    show('A carregar perfil...')
    try {
      if (currentAccount) {
        const { isAdmin: adminStatus } = await api.checkAdmin(currentAccount.account_id)
        setIsAdmin(adminStatus)
      }
      complete('Pronto!')
    } catch {
      hide()
    } finally {
      setIsLoading(false)
    }
  }

  const goBack = () => { show('A carregar...'); router.push('/dashboard') }
  const handleLogout = async () => { show('A sair...'); await logout() }
  const navigateTo = (path: string) => { show('A carregar...'); router.push(path) }

  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    href,
    external = false,
    iconColor,
    badge,
  }: {
    icon: React.ElementType
    label: string
    onClick?: () => void
    href?: string
    external?: boolean
    iconColor?: string
    badge?: string
  }) => {
    const content = (
      <>
        <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${iconColor || 'text-gray-400'}`}>
          <Icon size={18} />
        </span>
        <span className="flex-1 text-white text-sm font-medium text-left">{label}</span>
        {badge && (
          <span className="px-2 py-0.5 bg-[#a855f7]/20 text-[#a855f7] text-xs font-semibold rounded-full">
            {badge}
          </span>
        )}
        {external && <ExternalLink size={13} className="text-gray-500" />}
      </>
    )

    if (href) {
      return (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className="flex items-center gap-3 px-4 py-3 hover:bg-[#1a1f2e] rounded-xl transition-colors"
        >
          {content}
        </a>
      )
    }

    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1f2e] rounded-xl transition-colors"
      >
        {content}
      </button>
    )
  }

  if (isLoading) return null

  return (
    <div className="min-h-screen min-h-dvh bg-[#0a0e1a] text-white">
      <button
        onClick={goBack}
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-[#1a1f2e] hover:bg-[#2a3142] transition-colors"
      >
        <X size={20} />
      </button>

      <div className="max-w-md mx-auto px-4 py-12">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-2xl font-black tracking-[4px] mb-1"
            style={{
              fontFamily: 'Orbitron, system-ui, sans-serif',
              background: 'linear-gradient(135deg, #fff, #2ec7ff, #fff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            NEXORA
          </h1>
          <p className="text-gray-500 text-xs tracking-[2px] uppercase">FOREX TRADING PLATFORM</p>
        </div>

        {/* Online Count */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1117] rounded-xl mb-4">
          <div className="flex items-center gap-2">
            <Globe size={15} className="text-gray-500" />
            <span className="text-gray-400 text-sm">ONLINES</span>
          </div>
          <span className="text-[#2ec7ff] font-bold tabular-nums">
            {onlineCount.toLocaleString('pt-PT')}
          </span>
        </div>

        <div className="h-px bg-[#1a1f2e] mb-4" />

        {/* Menu Items */}
        <div className="space-y-1 mb-4">
          <MenuItem
            icon={LayoutDashboard}
            label="DASHBOARD"
            onClick={() => navigateTo('/dashboard')}
          />
          <MenuItem
            icon={Bot}
            label="OPERAR COM ROBÔS"
            onClick={() => navigateTo('/dashboard')}
          />
          <MenuItem
            icon={Landmark}
            label="CADASTRO NA CORRETORA"
            href="https://hub.deriv.com/tradershub/signup?t=hCp-xUFsKsktJe5FDKcTD2Nd7ZgqdRLk&utm_campaign=NEXORA&utm_medium=affiliate&utm_source=hCp-xUFsKsktJe5FDKcTD2Nd7ZgqdRLk"
            external
            iconColor="text-[#e63946]"
          />
          <MenuItem
            icon={MessageCircle}
            label="MENTORIA VIP WHATSAPP"
            href={`https://wa.me/${WHATSAPP}?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20a%20Mentoria%20VIP%20da%20Nexora%20Forex`}
            external
            iconColor="text-[#22c55e]"
          />
          <MenuItem
            icon={Link2}
            label="LINKS"
            href="#"
            external
          />

          {/* Avisos com badge */}
          <button
            onClick={() => setAvisosOpen(!avisosOpen)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1f2e] rounded-xl transition-colors"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg text-[#f59e0b]">
              <Bell size={18} />
            </span>
            <span className="flex-1 text-white text-sm font-medium text-left">AVISOS</span>
            {unreadAvisos > 0 && (
              <span className="w-5 h-5 bg-[#ef4444] text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadAvisos}
              </span>
            )}
            <ChevronDown
              size={13}
              className={`text-gray-500 transition-transform duration-200 ${avisosOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {avisosOpen && (
            <div className="mx-2 rounded-xl overflow-hidden border border-[#2a3142]">
              {LOCAL_AVISOS.map((aviso, idx) => (
                <div
                  key={aviso.id}
                  className={`px-4 py-3 bg-[#0d1117] ${idx < LOCAL_AVISOS.length - 1 ? 'border-b border-[#2a3142]' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-xs font-semibold">{aviso.titulo}</span>
                    <span className="text-gray-500 text-xs">{aviso.data}</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{aviso.mensagem}</p>
                </div>
              ))}
            </div>
          )}

          {/* Treinamento — WhatsApp com mensagem de solicitação */}
          <MenuItem
            icon={GraduationCap}
            label="TREINAMENTO COMPLETO"
            href={`https://wa.me/${WHATSAPP}?text=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20acesso%20ao%20Treinamento%20VIP%20completo%20da%20Nexora%20Forex.%20Pode%20me%20dar%20mais%20informa%C3%A7%C3%B5es%3F`}
            external
            iconColor="text-[#3b82f6]"
          />
        </div>

        <div className="h-px bg-[#1a1f2e] mb-4" />

        <div className="space-y-1 mb-4">
          <MenuItem
            icon={Gem}
            label="PRODUTOS VIP"
            href="#"
            external
            iconColor="text-[#a855f7]"
            badge="VIP"
          />
        </div>

        <div className="h-px bg-[#1a1f2e] mb-4" />

        <div className="space-y-1 mb-4">
          <MenuItem
            icon={DownloadCloud}
            label="DOWNLOADS"
            href="#"
            external
            iconColor="text-[#2ec7ff]"
          />

          {/* Termos e Condições */}
          <button
            onClick={() => setTermosOpen(!termosOpen)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1f2e] rounded-xl transition-colors"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400">
              <FileText size={18} />
            </span>
            <span className="flex-1 text-white text-sm font-medium text-left">TERMOS E CONDIÇÕES</span>
            <ChevronDown
              size={13}
              className={`text-gray-500 transition-transform duration-200 ${termosOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {termosOpen && (
            <div className="mx-2 rounded-xl overflow-hidden border border-[#2a3142] bg-[#0d1117]">
              <div className="flex border-b border-[#2a3142]">
                <button
                  onClick={() => setTermosTab('plataforma')}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                    termosTab === 'plataforma' ? 'text-[#2ec7ff] border-b-2 border-[#2ec7ff]' : 'text-gray-500'
                  }`}
                >
                  NEXORA FOREX
                </button>
                <button
                  onClick={() => setTermosTab('deriv')}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                    termosTab === 'deriv' ? 'text-[#2ec7ff] border-b-2 border-[#2ec7ff]' : 'text-gray-500'
                  }`}
                >
                  DERIV
                </button>
              </div>

              {termosTab === 'plataforma' ? (
                <div className="p-4 max-h-64 overflow-y-auto">
                  <pre className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                    {TERMOS_PLATAFORMA}
                  </pre>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Os termos e condições da Deriv estão disponíveis no site oficial da corretora.
                  </p>
                  <a
                    href="https://deriv.com/tnc/general-terms.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#2ec7ff] text-xs font-medium hover:underline"
                  >
                    <ExternalLink size={12} />
                    Termos Gerais — deriv.com
                  </a>
                  <a
                    href="https://deriv.com/tnc/funds-security.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#2ec7ff] text-xs font-medium hover:underline"
                  >
                    <ExternalLink size={12} />
                    Segurança de Fundos — deriv.com
                  </a>
                  <a
                    href="https://deriv.com/tnc/risk-disclosure.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#2ec7ff] text-xs font-medium hover:underline"
                  >
                    <ExternalLink size={12} />
                    Divulgação de Risco — deriv.com
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-[#1a1f2e] mb-4" />

        {/* Profile */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0d1117] rounded-xl mb-4">
          <div className="w-10 h-10 rounded-full bg-[#1a1f2e] flex items-center justify-center">
            <User size={18} className="text-gray-400" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">
              {currentAccount?.full_name || currentAccount?.name || 'Usuário'}
            </p>
            <p className="text-gray-500 text-xs">
              {currentAccount?.account_id || currentAccount?.loginid || '-'}
            </p>
          </div>
        </div>

        {/* Admin Panel */}
        {isAdmin && (
          <>
            <div className="h-px bg-[#1a1f2e] mb-4" />
            <div className="flex items-center gap-2 px-4 py-2 text-[#f59e0b]">
              <ShieldCheck size={13} />
              <span className="text-xs font-semibold tracking-wide">ADMIN</span>
            </div>
            <div className="space-y-1 mb-4">
              <button
                onClick={() => navigateTo('/admin')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1f2e] rounded-xl transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg text-[#f59e0b]">
                  <BarChart2 size={18} />
                </span>
                <span className="flex-1 text-white text-sm font-medium text-left">DASHBOARD ADMIN</span>
                <ChevronRight size={15} className="text-gray-500" />
              </button>
            </div>
          </>
        )}

        <div className="h-px bg-[#1a1f2e] mb-4" />

        {/* Logout */}
        <div className="space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#ef4444]/10 rounded-xl transition-colors group"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg text-[#ef4444]">
              <LogOut size={18} />
            </span>
            <span className="text-[#ef4444] text-sm font-medium">SAIR</span>
          </button>
        </div>

        <div className="h-10" />
      </div>
    </div>
  )
}
