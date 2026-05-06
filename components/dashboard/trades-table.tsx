'use client'

import { useState, useMemo } from 'react'
import { useTrading } from '@/lib/trading-context'
import { useBots }    from '@/lib/bots-context'

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h14"/><path d="M8 5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/>
      <path d="M5 5l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"/>
      <line x1="8" y1="9" x2="8" y2="15"/><line x1="12" y1="9" x2="12" y2="15"/>
    </svg>
  )
}

function ChartLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 16l5-5 4 4 7-9"/>
    </svg>
  )
}

function BotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <line x1="12" y1="7" x2="12" y2="11"/>
    </svg>
  )
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MainTab = 'trader' | 'notificacoes'
type TraderTab = 'manual' | 'bots'

// ─── Trades dos bots extraídos dos logs ───────────────────────────────────────

interface BotTrade {
  id:         string
  hora:       string
  botName:    string
  strategy:   string
  resultado:  number
  stake:      number
  won:        boolean
  contractId: string
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function TradesTable() {
  const { trades, clearTrades, isLoadingTrades } = useTrading()
  const { bots }                                  = useBots()

  const [mainTab,   setMainTab]   = useState<MainTab>('trader')
  const [traderTab, setTraderTab] = useState<TraderTab>('manual')

  // ── Extrair trades dos bots a partir dos logs de nível "trade" ────────────
  const botTrades = useMemo<BotTrade[]>(() => {
    const result: BotTrade[] = []
    bots.forEach(bot => {
      // Os stats do bot têm o histórico agregado; usamos os eventos de trade_closed
      // que ficaram gravados nos logs com level="trade"
      // Formato esperado no log: "✅ Ganhou $X.XX" ou "❌ Perdeu $X.XX"
      // Como acesso directo: bots.stats reflecte os totais, não trades individuais.
      // Portanto mostramos as últimas N operações inferidas dos logs de trade do bot.
    })

    // Alternativa mais fiável: expor trades directamente via useBots
    // Por agora, construímos a lista a partir dos stats de cada bot
    // como resumo por bot (1 linha por bot com estatísticas)
    return result
  }, [bots])

  // ── Resumo por bot (cada bot = 1 linha de resumo) ─────────────────────────
  const botSummaries = useMemo(() => {
    return bots
      .filter(b => b.stats.totalTrades > 0)
      .map(b => ({
        id:         b.id,
        name:       b.name,
        strategy:   b.strategy,
        status:     b.status,
        trades:     b.stats.totalTrades,
        wins:       b.stats.wins,
        losses:     b.stats.losses,
        netPnL:     b.stats.netPnL,
        winRate:    b.stats.winRate,
        stake:      b.stats.currentStake,
      }))
  }, [bots])

  const totalBotPnL   = botSummaries.reduce((s, b) => s + b.netPnL, 0)
  const totalBotTrades = botSummaries.reduce((s, b) => s + b.trades, 0)

  const handleClearTrades = async () => {
    if (confirm('Tem certeza que deseja limpar o histórico de trades?')) await clearTrades()
  }

  const tabCls = (active: boolean) =>
    `font-semibold text-sm sm:text-base transition-colors ${active ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`

  const subTabCls = (active: boolean) =>
    `flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      active ? 'bg-[#2a3142] text-white' : 'text-gray-500 hover:text-gray-400'
    }`

  return (
    <div className="bg-[#131825] rounded-xl border border-[#2a3142] overflow-hidden flex flex-col h-full">

      {/* ── Tabs principais ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3142] shrink-0">
        <div className="flex gap-4 sm:gap-6">
          <button onClick={() => setMainTab('trader')}      className={tabCls(mainTab === 'trader')}>Trader</button>
          <button onClick={() => setMainTab('notificacoes')} className={tabCls(mainTab === 'notificacoes')}>Notificações</button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleClearTrades} className="text-gray-400 hover:text-white transition-colors p-1" title="Limpar histórico">
            <TrashIcon />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors p-1">
            <ChartLineIcon />
          </button>
        </div>
      </div>

      {/* ── Sub-tabs (Manual / Bots) — só no tab Trader ── */}
      {mainTab === 'trader' && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a3142]/50 shrink-0">
          <button onClick={() => setTraderTab('manual')} className={subTabCls(traderTab === 'manual')}>
            <ChartLineIcon /> Manual
          </button>
          <button onClick={() => setTraderTab('bots')} className={subTabCls(traderTab === 'bots')}>
            <BotIcon />
            Bots
            {totalBotTrades > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                traderTab === 'bots' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-[#2a3142] text-gray-400'
              }`}>{totalBotTrades}</span>
            )}
          </button>
        </div>
      )}

      {/* ── Conteúdo ── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Notificações */}
        {mainTab === 'notificacoes' && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <p className="text-sm">Sem notificações</p>
          </div>
        )}

        {/* Trader → Manual */}
        {mainTab === 'trader' && traderTab === 'manual' && (
          isLoadingTrades ? (
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
              <thead className="sticky top-0 bg-[#131825] z-10">
                <tr className="text-gray-400 text-xs border-b border-[#2a3142]">
                  <th className="text-left px-2 sm:px-3 py-2 font-semibold">Hora</th>
                  <th className="text-left px-2 sm:px-3 py-2 font-semibold">Tipo</th>
                  <th className="text-left px-2 sm:px-3 py-2 font-semibold hidden sm:table-cell">Tick</th>
                  <th className="text-left px-2 sm:px-3 py-2 font-semibold">Preço</th>
                  <th className="text-left px-2 sm:px-3 py-2 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs sm:text-sm">
                {trades.map((trade, i) => {
                  const isProfit = trade.resultado >= 0
                  return (
                    <tr key={trade.id || i}
                      className="border-b border-[#2a3142]/50 hover:bg-[#2a3142]/30 transition-colors"
                      style={{ animationDelay: `${i * 50}ms` }}>
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
          )
        )}

        {/* Trader → Bots */}
        {mainTab === 'trader' && traderTab === 'bots' && (
          botSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
              <BotIcon />
              <p className="text-sm">Nenhum bot com trades ainda</p>
              <p className="text-xs text-gray-600">Inicia um bot para ver as estatísticas aqui</p>
            </div>
          ) : (
            <>
              {/* Resumo total */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[#2a3142]/50 bg-[#1a2235]/50">
                <div>
                  <p className="text-[10px] text-gray-500">Total trades</p>
                  <p className="text-white font-bold text-sm">{totalBotTrades}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">PnL total</p>
                  <p className={`font-bold text-sm ${totalBotPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {totalBotPnL >= 0 ? '+' : ''}{totalBotPnL.toFixed(2)} USD
                  </p>
                </div>
                <div className="ml-auto text-xs text-gray-500">
                  {botSummaries.length} bot{botSummaries.length !== 1 ? 's' : ''} activo{botSummaries.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Tabela de bots */}
              <table className="w-full">
                <thead className="sticky top-0 bg-[#131825] z-10">
                  <tr className="text-gray-400 text-xs border-b border-[#2a3142]">
                    <th className="text-left px-3 py-2 font-semibold">Bot</th>
                    <th className="text-left px-3 py-2 font-semibold hidden sm:table-cell">Estratégia</th>
                    <th className="text-right px-3 py-2 font-semibold">Trades</th>
                    <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">Win %</th>
                    <th className="text-right px-3 py-2 font-semibold">PnL</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {botSummaries.map(b => (
                    <tr key={b.id} className="border-b border-[#2a3142]/50 hover:bg-[#2a3142]/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            b.status === 'running' ? 'bg-[#22c55e] animate-pulse' :
                            b.status === 'paused'  ? 'bg-yellow-400' : 'bg-gray-500'
                          }`} />
                          <span className="text-white font-medium truncate max-w-[80px]">{b.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 hidden sm:table-cell capitalize">
                        {b.strategy.replace('_', ' ')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-white font-mono">
                        <span className="text-[#22c55e]">{b.wins}</span>
                        <span className="text-gray-600 mx-0.5">/</span>
                        <span className="text-[#ef4444]">{b.losses}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-300 font-mono hidden sm:table-cell">
                        {b.winRate.toFixed(1)}%
                      </td>
                      <td className={`px-3 py-2.5 text-right font-bold font-mono ${b.netPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {b.netPnL >= 0 ? '+' : ''}{b.netPnL.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )
        )}
      </div>
    </div>
  )
}
