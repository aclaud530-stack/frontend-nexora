'use client'

import { useState } from 'react'
import { useTrading } from '@/lib/trading-context'

// Ícone de lixeira
function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h14" />
      <path d="M8 5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
      <path d="M5 5l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
      <line x1="8" y1="9" x2="8" y2="15" />
      <line x1="12" y1="9" x2="12" y2="15" />
    </svg>
  )
}

// Ícone de gráfico/trending
function ChartLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 16l5-5 4 4 7-9" />
    </svg>
  )
}

export function TradesTable() {
  const { trades, clearTrades, isLoadingTrades } = useTrading()
  const [activeTab, setActiveTab] = useState<'trader' | 'notificacoes'>('trader')

  const handleClearTrades = async () => {
    if (confirm('Tem certeza que deseja limpar o histórico de trades?')) {
      await clearTrades()
    }
  }

  return (
    <div className="bg-[#1a1f2e] rounded-xl border-2 border-[#2a3142] overflow-hidden shadow-lg flex flex-col h-full">
      {/* Tabs e ícones */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b-2 border-[#2a3142] shrink-0">
        <div className="flex gap-4 sm:gap-6">
          <button
            onClick={() => setActiveTab('trader')}
            className={`font-semibold text-sm sm:text-base transition-colors ${
              activeTab === 'trader' 
                ? 'text-white' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Trader
          </button>
          <button
            onClick={() => setActiveTab('notificacoes')}
            className={`font-semibold text-sm sm:text-base transition-colors ${
              activeTab === 'notificacoes' 
                ? 'text-white' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Notificações
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleClearTrades}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Limpar histórico"
          >
            <TrashIcon />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors p-1">
            <ChartLineIcon />
          </button>
        </div>
      </div>

      {/* Tabela com scroll */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoadingTrades ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-[#2ec7ff] border-t-transparent rounded-full" />
          </div>
        ) : trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <ChartLineIcon />
            <p className="mt-2 text-sm">Nenhuma operação ainda</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[#1a1f2e] z-10">
              <tr className="text-gray-400 text-xs sm:text-sm border-b-2 border-[#2a3142]">
                <th className="text-left px-2 sm:px-3 py-2 font-semibold">Hora</th>
                <th className="text-left px-2 sm:px-3 py-2 font-semibold">Tipo</th>
                <th className="text-left px-2 sm:px-3 py-2 font-semibold hidden sm:table-cell">Tick Final</th>
                <th className="text-left px-2 sm:px-3 py-2 font-semibold">Preço</th>
                <th className="text-left px-2 sm:px-3 py-2 font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs sm:text-sm">
              {trades.map((trade, index) => {
                const isProfit = trade.resultado >= 0
                return (
                  <tr 
                    key={trade.id || index}
                    className="border-b border-[#2a3142]/50 hover:bg-[#2a3142]/30 transition-colors animate-fadeIn"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="px-2 sm:px-3 py-2.5 text-white">{trade.hora}</td>
                    <td className="px-2 sm:px-3 py-2.5 text-white text-[10px] sm:text-sm">{trade.tipo}</td>
                    <td className="px-2 sm:px-3 py-2.5 text-white hidden sm:table-cell">{trade.tickFinal}</td>
                    <td className="px-2 sm:px-3 py-2.5 text-white">{trade.preco}</td>
                    <td className={`px-2 sm:px-3 py-2.5 font-bold ${isProfit ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {isProfit ? '+' : '-'}{Math.abs(trade.resultado).toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
