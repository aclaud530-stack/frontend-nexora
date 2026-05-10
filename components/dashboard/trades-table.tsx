'use client'

// ============================================================
// NEXORA FOREX — Trades Table
// Trades em tempo real via bot:trade_closed do BotManager
// ============================================================

import { useState, useMemo } from 'react'
import { useBots, TradeRecord } from '@/lib/bots-context'
import { STRATEGY_LABELS } from '@/lib/nexora.types'

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

function BotIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <line x1="12" y1="7" x2="12" y2="11"/>
    </svg>
  )
}

function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#22c55e]/10 border border-[#22c55e]/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
      </span>
      <span className="text-[#22c55e] text-[10px] font-bold">LIVE</span>
    </div>
  )
}

type MainTab   = 'trader' | 'notificacoes'
type TraderTab = 'bots' | 'logs'

export function TradesTable() {
  // sessionBots substitui bots
  const { sessionBots, trades, botTrades, openTrades, botLogs, clearTrades, getBotLogs } = useBots()

  const [mainTab,       setMainTab]       = useState<MainTab>('trader')
  const [traderTab,     setTraderTab]     = useState<TraderTab>('bots')
  const [selectedBotId, setSelectedBotId] = useState<string | 'all'>('all')
  const [logBotId,      setLogBotId]      = useState<string>('')

  const activeBots  = useMemo(() => sessionBots.filter(b => b.stats.totalTrades > 0 || b.status === 'running'), [sessionBots])
  const runningBots = useMemo(() => sessionBots.filter(b => b.status === 'running'), [sessionBots])

  const displayTrades = useMemo<TradeRecord[]>(() => {
    if (selectedBotId === 'all') return trades
    return botTrades[selectedBotId] ?? []
  }, [trades, botTrades, selectedBotId])

  const openList = useMemo(() => Object.values(openTrades), [openTrades])

  const totalTrades = useMemo(() => activeBots.reduce((s, b) => s + b.stats.totalTrades, 0), [activeBots])
  const totalPnL    = useMemo(() => activeBots.reduce((s, b) => s + b.stats.netPnL,      0), [activeBots])
  const totalWins   = useMemo(() => activeBots.reduce((s, b) => s + b.stats.wins,         0), [activeBots])
  const totalLosses = useMemo(() => activeBots.reduce((s, b) => s + b.stats.losses,       0), [activeBots])

  const tabCls = (a: boolean) =>
    `font-semibold text-sm sm:text-base transition-colors ${a ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`

  const subTabCls = (a: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${a ? 'bg-[#2a3142] text-white' : 'text-gray-500 hover:text-gray-400'}`

  const handleGetLogs = (botId: string) => {
    setLogBotId(botId)
    getBotLogs(botId, 100)
    setTraderTab('logs')
  }

  return (
    <div className="bg-[#131825] rounded-xl border border-[#2a3142] overflow-hidden flex flex-col h-full">

      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3142] shrink-0">
        <div className="flex gap-4 sm:gap-6">
          <button onClick={() => setMainTab('trader')}       className={tabCls(mainTab === 'trader')}>Trader</button>
          <button onClick={() => setMainTab('notificacoes')} className={tabCls(mainTab === 'notificacoes')}>Notificações</button>
        </div>
        <div className="flex items-center gap-2">
          {runningBots.length > 0 && <LiveBadge />}
          <button onClick={() => { if (confirm('Limpar histórico de trades?')) clearTrades() }}
            className="text-gray-400 hover:text-white transition-colors p-1" title="Limpar">
            <TrashIcon />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors p-1">
            <ChartIcon />
          </button>
        </div>
      </div>

      {mainTab === 'trader' && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a3142]/50 shrink-0">
          <button onClick={() => setTraderTab('bots')} className={subTabCls(traderTab === 'bots')}>
            <BotIcon /> Bots
            {totalTrades > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${traderTab === 'bots' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-[#2a3142] text-gray-400'}`}>
                {totalTrades}
              </span>
            )}
          </button>
          <button onClick={() => setTraderTab('logs')} className={subTabCls(traderTab === 'logs')}>
            📋 Logs
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">

        {mainTab === 'notificacoes' && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <p className="text-sm">Sem notificações</p>
          </div>
        )}

        {mainTab === 'trader' && traderTab === 'bots' && (
          activeBots.length === 0 && openList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
              <BotIcon size={22} />
              <p className="text-sm">Nenhum bot activo ainda</p>
              <p className="text-xs text-gray-600">Selecciona um bot e toca em play para começar</p>
            </div>
          ) : (
            <>
              {openList.length > 0 && (
                <div className="border-b border-[#2a3142]/50">
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#f59e0b]/5">
                    <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0" />
                    <span className="text-[#f59e0b] text-[10px] font-bold uppercase tracking-wider">
                      {openList.length} contrato{openList.length !== 1 ? 's' : ''} aberto{openList.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {openList.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a3142]/30">
                      <span className="animate-spin w-3 h-3 border border-[#f59e0b] border-t-transparent rounded-full shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{t.botName}</p>
                        <p className="text-gray-500 text-[10px]">{t.hora} · stake ${t.stake.toFixed(2)}</p>
                      </div>
                      {t.direction && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${t.direction === 'CALL' ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#ef4444]/20 text-[#ef4444]'}`}>
                          {t.direction}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeBots.length > 0 && (
                <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[#2a3142]/50 bg-[#1a2235]/50">
                  <div><p className="text-[10px] text-gray-500">Total trades</p><p className="text-white font-bold text-sm">{totalTrades}</p></div>
                  <div>
                    <p className="text-[10px] text-gray-500">W / L</p>
                    <p className="text-sm font-mono">
                      <span className="text-[#22c55e] font-bold">{totalWins}</span>
                      <span className="text-gray-600 mx-0.5">/</span>
                      <span className="text-[#ef4444] font-bold">{totalLosses}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">PnL total</p>
                    <p className={`font-bold text-sm font-mono ${totalPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} USD
                    </p>
                  </div>
                  <div className="ml-auto text-xs text-gray-500">
                    {runningBots.length > 0 && <span className="text-[#22c55e] font-semibold mr-1">{runningBots.length} live</span>}
                    {activeBots.length} bot{activeBots.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}

              <div className="flex gap-1.5 px-4 py-2 border-b border-[#2a3142]/30 overflow-x-auto shrink-0">
                <button onClick={() => setSelectedBotId('all')}
                  className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${selectedBotId === 'all' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300'}`}>
                  Todos
                </button>
                {activeBots.map(b => (
                  <button key={b.id} onClick={() => setSelectedBotId(b.id)}
                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${selectedBotId === b.id ? 'bg-[#2a3142] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${b.status === 'running' ? 'bg-[#22c55e] animate-pulse' : b.status === 'paused' ? 'bg-[#f59e0b]' : 'bg-gray-500'}`} />
                    {b.name}
                  </button>
                ))}
              </div>

              <table className="w-full">
                <thead className="sticky top-0 bg-[#131825] z-10">
                  <tr className="text-gray-400 text-xs border-b border-[#2a3142]">
                    <th className="text-left px-3 py-2 font-semibold">Bot</th>
                    <th className="text-left px-3 py-2 font-semibold hidden sm:table-cell">Estratégia</th>
                    <th className="text-right px-3 py-2 font-semibold">W/L</th>
                    <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">Win%</th>
                    <th className="text-right px-3 py-2 font-semibold hidden md:table-cell">Drawdown</th>
                    <th className="text-right px-3 py-2 font-semibold">PnL</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {activeBots.map(b => (
                    <tr key={b.id}
                      onClick={() => setSelectedBotId(b.id === selectedBotId ? 'all' : b.id)}
                      className={`border-b border-[#2a3142]/50 hover:bg-[#2a3142]/30 cursor-pointer transition-colors ${selectedBotId === b.id ? 'bg-[#2a3142]/20' : ''}`}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.status === 'running' ? 'bg-[#22c55e] animate-pulse' : b.status === 'paused' ? 'bg-[#f59e0b]' : b.status === 'error' ? 'bg-[#ef4444]' : 'bg-gray-500'}`} />
                          <span className="text-white font-medium truncate max-w-[90px]">{b.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 hidden sm:table-cell capitalize text-[11px]">
                        {STRATEGY_LABELS[b.strategy]}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        <span className="text-[#22c55e]">{b.stats.wins}</span>
                        <span className="text-gray-600 mx-0.5">/</span>
                        <span className="text-[#ef4444]">{b.stats.losses}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-300 font-mono hidden sm:table-cell">
                        {b.stats.winRate.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#f59e0b] font-mono hidden md:table-cell text-[11px]">
                        -{b.stats.maxDrawdown.toFixed(2)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-bold font-mono ${b.stats.netPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {b.stats.netPnL >= 0 ? '+' : ''}{b.stats.netPnL.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={e => { e.stopPropagation(); handleGetLogs(b.id) }}
                          className="text-gray-600 hover:text-gray-300 text-[10px] transition-colors"
                          title="Ver logs"
                        >
                          📋
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {displayTrades.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 border-t border-[#2a3142] bg-[#1a2235]/30 shrink-0">
                    <span className="text-xs text-gray-400 font-medium">Histórico de trades</span>
                    <span className="ml-auto text-[10px] text-gray-600">{displayTrades.length} registos</span>
                  </div>
                  <table className="w-full">
                    <thead className="sticky top-0 bg-[#131825] z-10">
                      <tr className="text-gray-400 text-[10px] border-b border-[#2a3142]">
                        <th className="text-left px-3 py-1.5 font-semibold">Hora</th>
                        <th className="text-left px-3 py-1.5 font-semibold hidden sm:table-cell">Bot</th>
                        <th className="text-right px-3 py-1.5 font-semibold">Stake</th>
                        <th className="text-right px-3 py-1.5 font-semibold">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      {displayTrades.map((t, i) => (
                        <tr key={`${t.id}-${i}`}
                          className={`border-b border-[#2a3142]/40 hover:bg-[#2a3142]/20 transition-colors ${i === 0 ? 'bg-[#2a3142]/10' : ''}`}>
                          <td className="px-3 py-2 text-gray-400 text-[10px]">{t.hora}</td>
                          <td className="px-3 py-2 text-gray-400 text-[10px] hidden sm:table-cell truncate max-w-[80px]">{t.botName}</td>
                          <td className="px-3 py-2 text-right text-gray-500">${t.stake.toFixed(2)}</td>
                          <td className={`px-3 py-2 text-right font-bold ${t.profit >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                            {t.profit >= 0 ? '+' : ''}{t.profit.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )
        )}

        {mainTab === 'trader' && traderTab === 'logs' && (
          <div className="flex flex-col h-full">
            <div className="flex gap-1.5 px-4 py-2 border-b border-[#2a3142]/30 overflow-x-auto shrink-0">
              {sessionBots.map(b => (
                <button key={b.id} onClick={() => { setLogBotId(b.id); getBotLogs(b.id) }}
                  className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${logBotId === b.id ? 'bg-[#2a3142] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {b.name}
                </button>
              ))}
            </div>
            {!logBotId || !botLogs[logBotId] ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-500 gap-2">
                <p className="text-sm">Selecciona um bot para ver os logs</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto font-mono text-[10px] p-3 space-y-1">
                {botLogs[logBotId].map((log, i) => (
                  <div key={i} className={`flex gap-2 ${
                    log.level === 'error' ? 'text-[#ef4444]' :
                    log.level === 'warn'  ? 'text-[#f59e0b]' :
                    log.level === 'trade' ? 'text-[#22c55e]' :
                    'text-gray-400'
                  }`}>
                    <span className="text-gray-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString('pt-PT')}</span>
                    <span className={`shrink-0 font-bold ${log.level === 'trade' ? 'text-[#3b82f6]' : ''}`}>[{log.level.toUpperCase()}]</span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
