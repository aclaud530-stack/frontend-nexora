'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLoader } from '@/components/loader'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://banckend-production-14a1.up.railway.app'

export default function LoginPage() {
  const router = useRouter()
  const { show } = useLoader()
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      show('A carregar...')
      router.push('/dashboard')
    } else {
      setIsChecking(false)
    }
  }, [router, show])

  const handleLogin = async () => {
    setIsLoading(true)
    show('A redirecionar para Deriv...')
    try {
      const res = await fetch(`${API_URL}/api/auth/login`)
      const { authUrl } = await res.json()
      window.location.href = authUrl
    } catch (err) {
      console.error('[Login] error:', err)
      setIsLoading(false)
    }
  }

  const handleRegister = async () => {
    show('A redirecionar para registo...')
    try {
      const res = await fetch(`${API_URL}/api/auth/login?prompt=registration`)
      const { authUrl } = await res.json()
      window.location.href = authUrl
    } catch (err) {
      console.error('[Register] error:', err)
    }
  }

  if (isChecking) {
    return (
      <div className="min-h-screen min-h-dvh flex items-center justify-center bg-[#0a0e1a]">
        <div className="animate-spin w-8 h-8 border-2 border-[#2ec7ff] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen min-h-dvh flex items-center justify-center bg-[#0a0e1a] p-4 overflow-hidden">

      {/* Glow de fundo subtil — dá profundidade sem distrair */}
      <div
        className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(46,199,255,0.12) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,119,255,0.08) 0%, transparent 70%)' }}
      />

      {/* Cartão de login — efeito glass */}
      <div
        className="relative w-full max-w-[380px] rounded-2xl p-8 shadow-2xl"
        style={{
          background: 'rgba(13, 17, 23, 0.55)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-black tracking-[4px] mb-2"
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
            Forex Trading Platform
          </p>
        </div>

        <hr className="border-white/10 mb-6" />

        <p className="text-gray-400 text-sm text-center mb-6">
          Entre com sua conta Deriv para começar a negociar.
        </p>

        {/* Botão principal — acabamento sóbrio, sem brilho exagerado */}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl font-semibold text-white text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-[#2ec7ff]/30 bg-[#0f1c2e] hover:bg-[#13233a] active:bg-[#0c1828]"
        >
          {isLoading ? 'A carregar...' : 'Entrar com Deriv'}
        </button>

        <div className="flex items-center gap-4 my-6">
          <span className="flex-1 h-px bg-white/10" />
          <p className="text-gray-500 text-xs">Não tem conta?</p>
          <span className="flex-1 h-px bg-white/10" />
        </div>

        <div className="text-center">
          <button
            onClick={handleRegister}
            className="text-[#2ec7ff] hover:text-white text-sm font-medium transition-colors"
          >
            Criar conta Deriv
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-gray-600 text-xs mb-2">
            © 2026 Nexora Forex · Powered by Deriv API
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-gray-500 text-xs">OAuth 2.0 + PKCE</span>
          </div>
        </div>
      </div>
    </div>
  )
}
