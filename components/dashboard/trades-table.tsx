'use client'

// ============================================================
// NEXORA FOREX — Trades Table (simplificada)
// Hora | Tipo | Tick Final | Preço | Resultado
// ============================================================

import { useState } from 'react'
import { useBots, TradeRecord } from '@/lib/bots-context'

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h14"/><path d="M8 5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/>
      <path d="M5 5l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 16l5-5 4 4 7-9"/>
    </svg>
  )
}

function BotIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <line x1="12" y1="7" x2="12" y2="11"/>
    </svg>
  )
}

type MainTab = 'trader' | 'notificacoes'

export function TradesTable() {
  const { trades, clearTrades } = useBots()
  const [mainTab, setMainTab] = useState<MainTab>('trader')

  const tabCls = (a: boolean) =>
    `font-semibold text-sm sm:text-base transition-colors ${a ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`

  return (
    <div className="bg-[#131825] rounded-xl border border-[#2a3142] overflow-hidden flex flex-col h-full">

      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3142] shrink-0">
        <div className="flex gap-4 sm:gap-6">
          <button onClick={() => setMainTab('trader')}       className={tabCls(mainTab === 'trader')}>Trader</button>
          <button onClick={() => setMainTab('notificacoes')} className={tabCls(mainTab === 'notificacoes')}>Notificações</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (confirm('Limpar histórico de trades?')) clearTrades() }}
            className="text-gray-400 hover:text-white transition-colors p-1" title="Limpar">
            <TrashIcon />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors p-1">
            <ChartIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">

        {mainTab === 'notificacoes' && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <p className="text-sm">Sem notificações</p>
          </div>
        )}

        {mainTab === 'trader' && (
          trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
              <BotIcon />
              <p className="text-sm">Nenhum trade ainda</p>
              <p className="text-xs text-gray-600">Selecciona um bot e toca em play para começar</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-[#131825] z-10">
                <tr className="text-gray-400 text-xs border-b border-[#2a3142]">
                  <th className="text-left  px-3 py-2 font-semibold">Hora</th>
                  <th className="text-left  px-3 py-2 font-semibold">Tipo</th>
                  <th className="text-right px-3 py-2 font-semibold">Tick Final</th>
                  <th className="text-right px-3 py-2 font-semibold">Preço</th>
                  <th className="text-right px-3 py-2 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm font-mono">
                {trades.map((t: TradeRecord, i: number) => (
                  <tr key={`${t.id}-${i}`} className="border-b border-[#2a3142]/40 hover:bg-[#2a3142]/20 transition-colors">
                    <td className="px-3 py-2.5 text-gray-300">{t.hora}</td>
                    <td className="px-3 py-2.5 text-gray-300">{t.contractType ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">
                      {typeof t.exitTick === 'number' ? t.exitTick.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{t.stake.toFixed(2)}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${t.profit >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {t.profit >= 0 ? '' : '-'}{Math.abs(t.profit).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
