'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLoader } from '@/components/loader'

// Deriv OAuth2 Configuration
const CLIENT_ID = process.env.NEXT_PUBLIC_DERIV_CLIENT_ID || '3356rGdzrsnQaEKsg8MMA'
const REDIRECT_URI = process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI || (typeof window !== 'undefined' ? `${window.location.origin}/callback` : 'https://localhost:3000/callback')
const AUTH_URL = 'https://auth.deriv.com/oauth2/auth'

// Affiliate parameters
const AFFILIATE_TOKEN = 'hCp-xUFsKsktJe5FDKcTD2Nd7ZgqdRLk'
const UTM_CAMPAIGN = 'NEXORA'

/**
 * Generate PKCE (Proof Key for Code Exchange) parameters
 * Following Deriv OAuth2 documentation
 */
async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string; state: string }> {
  // 1. Generate a random code_verifier (43-128 characters)
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const codeVerifier = Array.from(array)
    .map(v => chars[v % chars.length])
    .join('')

  // 2. Derive the code_challenge = BASE64URL(SHA256(code_verifier))
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // 3. Generate a random state for CSRF protection
  const stateArray = new Uint8Array(16)
  crypto.getRandomValues(stateArray)
  const state = Array.from(stateArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // 4. Store before redirecting (sessionStorage survives the redirect)
  sessionStorage.setItem('pkce_code_verifier', codeVerifier)
  sessionStorage.setItem('oauth_state', state)

  return { codeVerifier, codeChallenge, state }
}

/**
 * Build the OAuth2 authorization URL
 */
function buildAuthUrl(params: {
  codeChallenge: string
  state: string
  isRegistration?: boolean
}): string {
  const url = new URL(AUTH_URL)
  
  // Required parameters
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('scope', 'trade')
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  
  // Registration prompt
  if (params.isRegistration) {
    url.searchParams.set('prompt', 'registration')
  }
  
  // Affiliate tracking
  url.searchParams.set('utm_campaign', UTM_CAMPAIGN)
  url.searchParams.set('utm_medium', 'affiliate')
  url.searchParams.set('utm_source', AFFILIATE_TOKEN)
  
  return url.toString()
}

export default function LoginPage() {
  const router = useRouter()
  const { show } = useLoader()
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check if already authenticated
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
      const { codeChallenge, state } = await generatePKCE()
      const authUrl = buildAuthUrl({ codeChallenge, state, isRegistration: false })
      window.location.href = authUrl
    } catch (err) {
      console.error('[Login] Error generating PKCE:', err)
      setIsLoading(false)
    }
  }

  const handleRegister = async () => {
    show('A redirecionar para registo...')
    
    try {
      const { codeChallenge, state } = await generatePKCE()
      const authUrl = buildAuthUrl({ codeChallenge, state, isRegistration: true })
      window.location.href = authUrl
    } catch (err) {
      console.error('[Login] Error generating PKCE for registration:', err)
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
    <div className="min-h-screen min-h-dvh flex items-center justify-center bg-[#0a0e1a] p-4">
      <div className="w-full max-w-[380px] bg-[#0d1117] rounded-2xl border border-[#1a1f2e] p-8 shadow-2xl">
        {/* Logo */}
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

        <hr className="border-[#1a1f2e] mb-6" />

        <p className="text-gray-400 text-sm text-center mb-6">
          Entre com sua conta Deriv para começar a negociar.
        </p>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #0077ff, #2ec7ff)',
            boxShadow: '0 4px 20px rgba(46, 199, 255, 0.3)',
          }}
        >
          {isLoading ? 'A carregar...' : 'Entrar com Deriv'}
        </button>

        {/* Separator */}
        <div className="flex items-center gap-4 my-6">
          <span className="flex-1 h-px bg-[#1a1f2e]" />
          <p className="text-gray-500 text-xs">Não tem conta?</p>
          <span className="flex-1 h-px bg-[#1a1f2e]" />
        </div>

        <div className="text-center">
          <button
            onClick={handleRegister}
            className="text-[#2ec7ff] hover:text-white text-sm font-medium transition-colors"
          >
            Criar conta Deriv
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#1a1f2e] text-center">
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
