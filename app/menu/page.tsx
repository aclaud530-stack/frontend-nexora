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
  ExternalLink
} from 'lucide-react'

export default function MenuPage() {
  const router = useRouter()
  const { currentAccount, logout } = useAuth()
  const { show, complete, hide } = useLoader()
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    
    loadData()
  }, [])

  const loadData = async () => {
    show('A carregar perfil...')
    
    try {
      // Carregar contagem de online
      const { count } = await api.getOnlineCount()
      setOnlineCount(count)
      
      // Verificar admin
      if (currentAccount) {
        const { isAdmin: adminStatus } = await api.checkAdmin(currentAccount.account_id)
        setIsAdmin(adminStatus)
      }
      
      complete('Pronto!')
    } catch (error) {
      console.error('[v0] Failed to load menu data:', error)
      hide()
    } finally {
      setIsLoading(false)
    }
  }

  const goBack = () => {
    show('A carregar...')
    router.push('/dashboard')
  }

  const handleLogout = async () => {
    show('A sair...')
    await logout()
  }

  const navigateTo = (path: string) => {
    show('A carregar...')
    router.push(path)
  }

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
        <span className="flex-1 text-white text-sm font-medium">{label}</span>
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
          onClick={() => !external && onClick?.()}
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

  if (isLoading) {
    return null
  }

  return (
    <div className="min-h-screen min-h-dvh bg-[#0a0e1a] text-white">
      {/* Close Button */}
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
          <p className="text-gray-500 text-xs tracking-[2px] uppercase">
            FOREX TRADING PLATFORM
          </p>
        </div>

        {/* Online Count */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1117] rounded-xl mb-4">
          <div className="flex items-center gap-2">
            <Globe size={15} className="text-gray-500" />
            <span className="text-gray-400 text-sm">ONLINES</span>
          </div>
          <span className="text-[#2ec7ff] font-bold">
            {onlineCount ?? '...'}
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
            href="https://wa.me/SEU_NUMERO?text=Ol%C3%A1,%20quero%20saber%20mais%20sobre%20a%20Mentoria%20VIP"
            external
            iconColor="text-[#22c55e]"
          />
          <MenuItem 
            icon={Link2} 
            label="LINKS" 
            href="#"
            external
          />
          <MenuItem 
            icon={Bell} 
            label="AVISOS" 
            onClick={() => {}}
            iconColor="text-[#f59e0b]"
          />
          <MenuItem 
            icon={GraduationCap} 
            label="TREINAMENTO COMPLETO" 
            href="#"
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
          <MenuItem 
            icon={FileText} 
            label="TERMOS E CONDIÇÕES" 
            onClick={() => {}}
          />
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
                <span className="flex-1 text-white text-sm font-medium">DASHBOARD ADMIN</span>
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
            <span className="text-[#ef4444] text-sm font-medium group-hover:text-[#ef4444]">SAIR</span>
          </button>
        </div>

        <div className="h-10" />
      </div>
    </div>
  )
}
