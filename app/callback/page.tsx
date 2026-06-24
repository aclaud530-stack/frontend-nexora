'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLoader } from '@/components/loader'
import { useAuth } from '@/lib/auth-context'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { show, complete, hide } = useLoader()
  const { login } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    handleOAuthCallback()
  }, [])

  const handleOAuthCallback = async () => {
    show('A processar autenticação...')

    // Verificar erro
    const error = searchParams.get('error')
    if (error) {
      setStatus('error')
      setErrorMessage(searchParams.get('error_description') || `Erro: ${error}`)
      hide()
      return
    }

    // Ler token enviado pelo backend
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setErrorMessage('Token não encontrado. Tenta fazer login novamente.')
      hide()
      return
    }

    // ── FIX: login() explícito em vez de só localStorage.setItem ──
    // login() grava o token, busca as contas e popula currentAccount
    // de forma síncrona aqui mesmo — antes de navegar para /dashboard.
    // Isto elimina a race condition em que o BotsProvider/useNexoraWs
    // monta com accountId ainda nulo e a ligação WS nunca autentica,
    // obrigando o utilizador a recarregar a página para funcionar.
    const ok = await login(token)

    if (!ok) {
      setStatus('error')
      setErrorMessage('Não foi possível validar a conta. Tenta fazer login novamente.')
      hide()
      return
    }

    // Limpar session storage
    sessionStorage.removeItem('pkce_code_verifier')
    sessionStorage.removeItem('oauth_state')

    setStatus('success')
    complete('Autenticação bem sucedida!')

    // Já não depende de um setTimeout arbitrário — accounts e
    // currentAccount já estão garantidamente prontos neste ponto,
    // por isso o dashboard monta já com tudo o que precisa.
    router.push('/dashboard')
  }

  const handleRetry = () => {
    sessionStorage.clear()
    localStorage.removeItem('token')
    router.push('/')
  }

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center bg-[#0a0e1a] p-4">
      <div className="text-center max-w-md">
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="animate-spin w-12 h-12 border-2 border-[#2ec7ff] border-t-transparent rounded-full mx-auto" />
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
          <div className="animate-spin w-12 h-12 border-2 border-[#2ec7ff] border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-400">A carregar...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
