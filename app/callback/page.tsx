'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLoader } from '@/components/loader'

/**
 * Callback Handler for Deriv OAuth2
 * Following the official Deriv API documentation
 */
function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { show, complete, hide } = useLoader()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    handleOAuthCallback()
  }, [])

  const handleOAuthCallback = async () => {
    show('A processar autenticação...')

    // 1. Check for error response from Deriv
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    
    if (error) {
      setStatus('error')
      setErrorMessage(errorDescription || `Erro de autenticação: ${error}`)
      hide()
      return
    }

    // 2. Get authorization code and state from URL
    const code = searchParams.get('code')
    const returnedState = searchParams.get('state')
    
    if (!code) {
      setStatus('error')
      setErrorMessage('Código de autorização não encontrado')
      hide()
      return
    }

    // 3. Verify state matches (CSRF protection)
    const savedState = sessionStorage.getItem('oauth_state')
    
    if (returnedState !== savedState) {
      setStatus('error')
      setErrorMessage('Erro de validação CSRF: state não corresponde')
      hide()
      console.error('[Callback] State mismatch:', { returnedState, savedState })
      return
    }

    // 4. Get the code_verifier that was stored before redirect
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier')
    
    if (!codeVerifier) {
      setStatus('error')
      setErrorMessage('Code verifier não encontrado. Por favor, tente fazer login novamente.')
      hide()
      return
    }

    try {
      // 5. Exchange authorization code for access token via backend
      // The backend handles the actual token exchange to keep client_secret secure
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      
      const response = await fetch(`${apiUrl}/api/auth/callback`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          code,
          code_verifier: codeVerifier,
          redirect_uri: process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI || `${window.location.origin}/callback`
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP ${response.status}`)
      }

      // Backend returns { success: true, data: { accessToken, expiresIn, userId } }
      const tokenData = data.data || data
      
      if (tokenData.accessToken || tokenData.access_token) {
        // 6. Store the access token securely
        const accessToken = tokenData.accessToken || tokenData.access_token
        localStorage.setItem('token', accessToken)
        
        // Store token expiry if provided
        const expiresIn = tokenData.expiresIn || tokenData.expires_in
        if (expiresIn) {
          const expiresAt = Date.now() + (expiresIn * 1000)
          localStorage.setItem('token_expires_at', expiresAt.toString())
        }
        
        // Store user ID if provided
        if (tokenData.userId) {
          localStorage.setItem('userId', tokenData.userId)
        }
        
        // 7. Clean up session storage (PKCE values no longer needed)
        sessionStorage.removeItem('pkce_code_verifier')
        sessionStorage.removeItem('oauth_state')
        
        setStatus('success')
        complete('Autenticação bem sucedida!')
        
        // 8. Redirect to dashboard
        setTimeout(() => {
          router.push('/dashboard')
        }, 800)
      } else {
        throw new Error('Token de acesso não recebido')
      }
    } catch (err) {
      console.error('[Callback] Token exchange failed:', err)
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Falha na autenticação')
      hide()
    }
  }

  const handleRetry = () => {
    // Clear any stored state and redirect to login
    sessionStorage.clear()
    localStorage.removeItem('token')
    router.push('/')
  }

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center bg-[#0a0e1a] p-4">
      <div className="text-center max-w-md">
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="animate-spin w-12 h-12 border-3 border-[#2ec7ff] border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-400 text-lg">A processar autenticação...</p>
            <p className="text-gray-600 text-sm">Por favor, aguarde enquanto validamos as suas credenciais.</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-[#22c55e]/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[#22c55e] text-xl font-semibold">Autenticação bem sucedida!</p>
            <p className="text-gray-500 text-sm">A redirecionar para o dashboard...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-[#ef4444]/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-[#ef4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-[#ef4444] text-xl font-semibold mb-2">Erro de autenticação</p>
              <p className="text-gray-400 text-sm">{errorMessage}</p>
            </div>
            <button
              onClick={handleRetry}
              className="px-6 py-3 rounded-xl bg-[#1a1f2e] text-white hover:bg-[#2a3142] transition-colors font-medium"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen min-h-dvh flex items-center justify-center bg-[#0a0e1a]">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-3 border-[#2ec7ff] border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-400">A carregar...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
