'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTrading } from '@/lib/trading-context'
import { X, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Clock, DollarSign } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface BarEntry {
  digit: number
  percentage: number
  isHighlight: boolean
  isLow: boolean
}

interface CandleData {
  x: number
  o: number
  h: number
  l: number
  c: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const TICK_OPTIONS = [25, 50, 100, 250, 500, 1000]

const FALLBACK_BARS: BarEntry[] = [
  { digit: 0, percentage:  8.0, isHighlight: false, isLow: false },
  { digit: 1, percentage:  8.0, isHighlight: false, isLow: false },
  { digit: 2, percentage: 28.0, isHighlight: true,  isLow: false },
  { digit: 3, percentage:  4.0, isHighlight: false, isLow: true  },
  { digit: 4, percentage: 12.0, isHighlight: false, isLow: false },
  { digit: 5, percentage:  4.0, isHighlight: false, isLow: true  },
  { digit: 6, percentage: 12.0, isHighlight: false, isLow: false },
  { digit: 7, percentage:  4.0, isHighlight: false, isLow: true  },
  { digit: 8, percentage:  8.0, isHighlight: false, isLow: false },
  { digit: 9, percentage: 12.0, isHighlight: false, isLow: false },
]

// ─────────────────────────────────────────────────────────────────────────────
// Ícones
// ─────────────────────────────────────────────────────────────────────────────

function BarChartIcon({ active }: { active: boolean }) {
  const c = active ? '#1a1f2e' : '#9ca3af'
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="2"  y="10" width="4" height="8"  rx="1" fill={c} />
      <rect x="8"  y="6"  width="4" height="12" rx="1" fill={c} />
      <rect x="14" y="2"  width="4" height="16" rx="1" fill={c} />
    </svg>
  )
}

function CandleChartIcon({ active }: { active: boolean }) {
  const bull = active ? '#22c55e' : '#9ca3af'
  const bear = active ? '#dc2626' : '#9ca3af'
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="3"    y="6"  width="3" height="8"  rx="0.5" fill={bull} />
      <line x1="4.5" y1="2"  x2="4.5" y2="6"  stroke={bull} strokeWidth="1" />
      <line x1="4.5" y1="14" x2="4.5" y2="18" stroke={bull} strokeWidth="1" />
      <rect x="8.5"  y="4"  width="3" height="10" rx="0.5" fill={bear} />
      <line x1="10"  y1="1"  x2="10"  y2="4"  stroke={bear} strokeWidth="1" />
      <line x1="10"  y1="14" x2="10"  y2="17" stroke={bear} strokeWidth="1" />
      <rect x="14"   y="5"  width="3" height="7"  rx="0.5" fill={bull} />
      <line x1="15.5" y1="2"  x2="15.5" y2="5"  stroke={bull} strokeWidth="1" />
      <line x1="15.5" y1="12" x2="15.5" y2="16" stroke={bull} strokeWidth="1" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Gráfico de Barras (modo normal)
// ─────────────────────────────────────────────────────────────────────────────

function DigitBarChart({ bars }: { bars: BarEntry[] }) {
  const MAX_PCT = 35
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex items-end gap-[3px] sm:gap-[5px] px-1 pb-0 min-h-0">
        {bars.map((bar) => {
          const heightPct = (bar.percentage / MAX_PCT) * 100
          const bgColor = bar.isHighlight ? '#2d8a4e' : bar.isLow ? '#9b2335' : '#c8cdd6'
          return (
            <div key={bar.digit} className="flex-1 flex flex-col items-center justify-end gap-[3px]" style={{ height: '100%' }}>
              <span className="text-white font-medium leading-none" style={{ fontSize: 'clamp(8px, 1.8vw, 11px)' }}>
                {bar.percentage.toFixed(1)}%
              </span>
              <div style={{
                height: `${heightPct}%`,
                backgroundColor: bgColor,
                width: '100%',
                borderRadius: '3px 3px 0 0',
                minHeight: bar.percentage > 0 ? 6 : 0,
                transition: 'height 0.4s ease',
              }} />
            </div>
          )
        })}
      </div>
      <div className="h-px bg-[#3a4255] mx-1" />
      <div className="flex gap-[3px] sm:gap-[5px] px-1 pt-1">
        {bars.map((bar) => (
          <div key={bar.digit} className="flex-1 flex items-center justify-center">
            <span className="text-white font-bold" style={{ fontSize: 'clamp(10px, 2vw, 14px)' }}>
              {bar.digit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Candlestick SVG (modo normal — pequeno)
// ─────────────────────────────────────────────────────────────────────────────

function CandlestickChart({ candles }: { candles: CandleData[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const H = 220
  const pad = { top: 15, right: 10, bottom: 30, left: 48 }
  const plotW = width - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  if (candles.length === 0) return <div ref={containerRef} className="w-full h-full" />

  const prices = candles.flatMap(c => [c.h, c.l])
  const yMin = Math.min(...prices) - 0.3
  const yMax = Math.max(...prices) + 0.3
  const yRange = yMax - yMin || 1
  const candleW = Math.max(3, plotW / candles.length - 1.5)
  const toY = (v: number) => pad.top + plotH - ((v - yMin) / yRange) * plotH
  const toX = (i: number) => pad.left + (i / candles.length) * plotW + candleW / 2
  const labelStep = Math.ceil(candles.length / 8)

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const val = yMin + pct * yRange
          const y = pad.top + plotH - pct * plotH
          return (
            <g key={pct}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#2a3142" strokeWidth="1" strokeDasharray="2,2" />
              <text x={pad.left - 4} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="9">{val.toFixed(2)}</text>
            </g>
          )
        })}
        {candles.map((c, i) => {
          const bull = c.c >= c.o
          const color = bull ? '#22c55e' : '#dc2626'
          const x = toX(i)
          const bodyTop = Math.min(toY(c.o), toY(c.c))
          const bodyH = Math.max(1, Math.abs(toY(c.c) - toY(c.o)))
          return (
            <g key={i}>
              <line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={color} strokeWidth="1" />
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} rx="0.5" />
            </g>
          )
        })}
        {candles.filter((_, i) => i % labelStep === 0).map((c) => {
          const i = candles.indexOf(c)
          const time = new Date(c.x).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
          return (
            <text key={i} x={toX(i)} y={H - 8} textAnchor="middle" fill="#9ca3af" fontSize="9">{time}</text>
          )
        })}
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Candlestick SVG GRANDE (dentro do modal Quotex)
// ─────────────────────────────────────────────────────────────────────────────

function CandlestickLarge({ candles, currentPrice }: { candles: CandleData[]; currentPrice: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth]   = useState(800)
  const [height, setHeight] = useState(400)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => {
      setWidth(e.contentRect.width)
      setHeight(e.contentRect.height)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const pad = { top: 20, right: 70, bottom: 32, left: 10 }
  const plotW = width  - pad.left - pad.right
  const plotH = height - pad.top  - pad.bottom

  if (candles.length === 0) return <div ref={containerRef} className="w-full h-full" />

  const prices = candles.flatMap(c => [c.h, c.l])
  const yMin   = Math.min(...prices) - 0.5
  const yMax   = Math.max(...prices) + 0.5
  const yRange = yMax - yMin || 1
  const candleW  = Math.max(4, plotW / candles.length - 2)
  const toY = (v: number) => pad.top + plotH - ((v - yMin) / yRange) * plotH
  const toX = (i: number) => pad.left + (i / candles.length) * plotW + candleW / 2
  const labelStep = Math.ceil(candles.length / 10)

  // Nível do preço actual
  const priceY = toY(currentPrice)

  // Calcular número de linhas de grid
  const gridCount = 6
  const gridValues = Array.from({ length: gridCount }, (_, i) =>
    yMin + (i / (gridCount - 1)) * yRange
  )

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid horizontal */}
        {gridValues.map((val, idx) => {
          const y = toY(val)
          return (
            <g key={idx}>
              <line
                x1={pad.left} y1={y}
                x2={width - pad.right} y2={y}
                stroke="#1e2535" strokeWidth="1"
              />
              {/* Label eixo Y (direita) */}
              <text
                x={width - pad.right + 6}
                y={y + 4}
                fill="#6b7280"
                fontSize="10"
              >
                {val.toFixed(4)}
              </text>
            </g>
          )
        })}

        {/* Grid vertical */}
        {candles.filter((_, i) => i % labelStep === 0).map((c, idx) => {
          const i   = candles.indexOf(c)
          const x   = toX(i)
          const time = new Date(c.x).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
          return (
            <g key={idx}>
              <line x1={x} y1={pad.top} x2={x} y2={pad.top + plotH} stroke="#1e2535" strokeWidth="1" />
              <text x={x} y={height - 8} textAnchor="middle" fill="#6b7280" fontSize="10">{time}</text>
            </g>
          )
        })}

        {/* Candles */}
        {candles.map((c, i) => {
          const bull    = c.c >= c.o
          const color   = bull ? '#22c55e' : '#ef4444'
          const x       = toX(i)
          const bodyTop = Math.min(toY(c.o), toY(c.c))
          const bodyH   = Math.max(1.5, Math.abs(toY(c.c) - toY(c.o)))
          return (
            <g key={i}>
              {/* Pavio */}
              <line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={color} strokeWidth="1.2" />
              {/* Corpo */}
              <rect
                x={x - candleW / 2} y={bodyTop}
                width={candleW} height={bodyH}
                fill={color} rx="1"
              />
            </g>
          )
        })}

        {/* Linha de preço actual (tracejada) */}
        <line
          x1={pad.left} y1={priceY}
          x2={width - pad.right} y2={priceY}
          stroke="#9ca3af" strokeWidth="1"
          strokeDasharray="4,3"
        />
        {/* Badge preço actual */}
        <rect
          x={width - pad.right + 2} y={priceY - 10}
          width={64} height={20}
          fill="#2563eb" rx="3"
        />
        <text
          x={width - pad.right + 34} y={priceY + 4}
          textAnchor="middle" fill="white"
          fontSize="10" fontWeight="bold"
        >
          {currentPrice.toFixed(4)}
        </text>
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Quotex — interface completa
// ─────────────────────────────────────────────────────────────────────────────

function QuotexModal({
  onClose,
  candles,
  currentPrice,
  balance,
  trades,
}: {
  onClose: () => void
  candles: CandleData[]
  currentPrice: number
  balance: number
  trades: Array<{ id: string | number; resultado: number; amount?: number; created_at?: string }>
}) {
  const [investment, setInvestment] = useState(15)
  const [timeSeconds, setTimeSeconds] = useState(60)
  const [payout] = useState(93)
  const [activeTab, setActiveTab] = useState<'trades' | 'timer'>('trades')

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const payoutValue = +(investment * (1 + payout / 100)).toFixed(2)

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: '#0d1117' }}
    >
      {/* ── Top Bar ── */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: '#1e2535', background: '#0d1117' }}
      >
        {/* Par + payout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[#1e2535] flex items-center justify-center text-[10px]">🇺🇸</div>
            <span className="text-white font-bold text-sm">1HZ100V</span>
            <span className="text-[#22c55e] font-bold text-sm">{payout}%</span>
          </div>
        </div>

        {/* Saldo */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#1e2535] rounded-lg px-3 py-1.5">
            <div className="w-4 h-4 rounded-full bg-[#a855f7] flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">$</span>
            </div>
            <span className="text-white font-bold text-sm">${balance.toFixed(2)}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1e2535] transition-colors text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Gráfico (área principal) ── */}
        <div className="flex-1 flex flex-col min-w-0 relative">

          {/* Info topo do gráfico */}
          <div
            className="flex items-center gap-4 px-3 py-1.5 text-xs border-b shrink-0"
            style={{ borderColor: '#1e2535' }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-[#22c55e] font-semibold">AO VIVO</span>
            </div>
            <span className="text-gray-500">
              {new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
            </span>
            <span className="text-[#2563eb] text-xs font-medium">Início da operação →</span>
          </div>

          {/* SVG candlestick grande */}
          <div className="flex-1 min-h-0 px-2 py-1">
            <CandlestickLarge candles={candles} currentPrice={currentPrice} />
          </div>

          {/* Barra inferior do gráfico */}
          <div
            className="flex items-center justify-between px-3 py-1.5 border-t shrink-0 text-xs"
            style={{ borderColor: '#1e2535' }}
          >
            <span className="text-gray-500 font-medium">1m</span>
            <div className="flex items-center gap-3 text-gray-500">
              <span>{currentPrice.toFixed(4)}</span>
            </div>
          </div>
        </div>

        {/* ── Painel lateral direito ── */}
        <div
          className="w-[200px] sm:w-[220px] flex flex-col border-l shrink-0"
          style={{ borderColor: '#1e2535', background: '#0d1117' }}
        >

          {/* PENDING TRADE toggle */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b shrink-0"
            style={{ borderColor: '#1e2535' }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#2563eb] animate-pulse" />
              <span className="text-[#2563eb] text-[11px] font-semibold tracking-wide">PENDING TRADE</span>
            </div>
            <div className="w-8 h-4 bg-[#2563eb] rounded-full flex items-center justify-end px-0.5">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
          </div>

          {/* Time */}
          <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: '#1e2535' }}>
            <span className="text-gray-500 text-[10px] font-medium tracking-wide">Time</span>
            <div className="flex items-center justify-between mt-1">
              <button
                onClick={() => setTimeSeconds(t => Math.max(5, t - 5))}
                className="w-7 h-7 rounded-lg bg-[#1e2535] text-white font-bold text-lg flex items-center justify-center hover:bg-[#2a3142] transition-colors"
              >
                −
              </button>
              <span className="text-white font-bold text-base tabular-nums">
                {formatTime(timeSeconds)}
              </span>
              <button
                onClick={() => setTimeSeconds(t => Math.min(3600, t + 5))}
                className="w-7 h-7 rounded-lg bg-[#1e2535] text-white font-bold text-lg flex items-center justify-center hover:bg-[#2a3142] transition-colors"
              >
                +
              </button>
            </div>
            <div className="text-center mt-1">
              <span className="text-[#2563eb] text-[10px] font-semibold tracking-wider">SWITCH TIME</span>
            </div>
          </div>

          {/* Investment */}
          <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: '#1e2535' }}>
            <span className="text-gray-500 text-[10px] font-medium tracking-wide">Investment</span>
            <div className="flex items-center justify-between mt-1">
              <button
                onClick={() => setInvestment(v => Math.max(1, v - 1))}
                className="w-7 h-7 rounded-lg bg-[#1e2535] text-white font-bold text-lg flex items-center justify-center hover:bg-[#2a3142] transition-colors"
              >
                −
              </button>
              <span className="text-white font-bold text-base tabular-nums">
                {investment} $
              </span>
              <button
                onClick={() => setInvestment(v => v + 1)}
                className="w-7 h-7 rounded-lg bg-[#1e2535] text-white font-bold text-lg flex items-center justify-center hover:bg-[#2a3142] transition-colors"
              >
                +
              </button>
            </div>
            <div className="text-center mt-1">
              <span className="text-[#2563eb] text-[10px] font-semibold tracking-wider">SWITCH</span>
            </div>
          </div>

          {/* Botões Up / Down */}
          <div className="px-3 py-2 space-y-2 shrink-0">
            <button className="w-full py-3 rounded-xl font-bold text-white text-base flex items-center justify-between px-4 transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}
            >
              <span>Up</span>
              <ChevronUp size={20} className="opacity-80" />
            </button>

            <div className="text-center">
              <span className="text-gray-400 text-xs">Your payout: </span>
              <span className="text-white text-xs font-bold">{payoutValue.toFixed(2)} $</span>
            </div>

            <button className="w-full py-3 rounded-xl font-bold text-white text-base flex items-center justify-between px-4 transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #b91c1c, #ef4444)' }}
            >
              <span>Down</span>
              <ChevronDown size={20} className="opacity-80" />
            </button>
          </div>

          {/* Tabs Trades / Timer */}
          <div className="flex border-b border-t shrink-0" style={{ borderColor: '#1e2535' }}>
            <button
              onClick={() => setActiveTab('trades')}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                activeTab === 'trades'
                  ? 'text-[#2563eb] border-b-2 border-[#2563eb]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Trades
            </button>
            <button
              onClick={() => setActiveTab('timer')}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                activeTab === 'timer'
                  ? 'text-[#2563eb] border-b-2 border-[#2563eb]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Clock size={12} className="inline mr-1" />
              {formatTime(timeSeconds)}
            </button>
          </div>

          {/* Lista de trades */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 text-xs gap-2 py-6">
                <DollarSign size={24} className="opacity-40" />
                <span>Sem operações</span>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#1e2535' }}>
                {trades.slice(0, 20).map((trade, idx) => {
                  const isWin = trade.resultado >= 0
                  return (
                    <div key={trade.id ?? idx} className="px-3 py-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-[#1e2535] flex items-center justify-center text-[7px]">🇺🇸</div>
                          <span className="text-white text-[10px] font-semibold">1HZ100V</span>
                        </div>
                        <span className="text-gray-500 text-[9px]">
                          {trade.created_at
                            ? new Date(trade.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                            : '--:--'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-[10px]">
                          {trade.amount ?? investment} $
                        </span>
                        <span className={`text-[10px] font-bold ${isWin ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {isWin ? '+' : ''}{trade.resultado.toFixed(2)} $
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────

export function ChartSection() {
  const { chartData, selectedTicks, setSelectedTicks, lastDigit: contextLastDigit, balance, trades } = useTrading()
  const [activeChart, setActiveChart] = useState<'bar' | 'candle'>('candle')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [candleData, setCandleData] = useState<CandleData[]>([])
  const [displayDigit, setDisplayDigit] = useState(2)
  const [showQuotex, setShowQuotex] = useState(false)

  // Sincronizar dados do contexto
  useEffect(() => {
    if (chartData?.candleData?.length) setCandleData(chartData.candleData)
    if (chartData?.lastDigit !== undefined) setDisplayDigit(chartData.lastDigit)
  }, [chartData])

  useEffect(() => {
    if (contextLastDigit !== undefined) setDisplayDigit(contextLastDigit)
  }, [contextLastDigit])

  const generateMockCandles = useCallback((): CandleData[] => {
    const now = Date.now()
    let price = 43.9944
    return Array.from({ length: 60 }, (_, i) => {
      const open  = price
      const change = (Math.random() - 0.5) * 0.004
      const close  = +(open + change).toFixed(4)
      price = close
      return {
        x: now - (60 - i) * 60000,
        o: open,
        h: +(Math.max(open, close) + Math.random() * 0.001).toFixed(4),
        l: +(Math.min(open, close) - Math.random() * 0.001).toFixed(4),
        c: close,
      }
    })
  }, [])

  useEffect(() => {
    if (candleData.length === 0) setCandleData(generateMockCandles())
  }, [candleData.length, generateMockCandles])

  const bars: BarEntry[] = chartData?.barData || FALLBACK_BARS
  const highlightedDigit = bars.find(d => d.isHighlight)?.digit ?? displayDigit
  const currentPrice = candleData[candleData.length - 1]?.c ?? 43.9944

  return (
    <>
      {/* ── Modal Quotex (fullscreen) ── */}
      {showQuotex && (
        <QuotexModal
          onClose={() => setShowQuotex(false)}
          candles={candleData}
          currentPrice={currentPrice}
          balance={balance}
          trades={trades}
        />
      )}

      {/* ── Card normal ── */}
      <div className="bg-[#131825] rounded-xl border border-[#2a3142] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#131825]">
          <div className="flex items-center gap-1">
            {/* Ícone barras — modo bar */}
            <button
              onClick={() => setActiveChart('bar')}
              className={`p-2 rounded-lg transition-all ${
                activeChart === 'bar' ? 'bg-white shadow' : 'hover:bg-[#1e2535]'
              }`}
            >
              <BarChartIcon active={activeChart === 'bar'} />
            </button>

            {/* Ícone candle — abre modal Quotex */}
            <button
              onClick={() => {
                setActiveChart('candle')
                setShowQuotex(true)
              }}
              className={`p-2 rounded-lg transition-all ${
                activeChart === 'candle' ? 'bg-white shadow' : 'hover:bg-[#1e2535]'
              }`}
            >
              <CandleChartIcon active={activeChart === 'candle'} />
            </button>
          </div>

          {/* Centro */}
          <span className="text-white font-semibold text-sm sm:text-base tracking-wide">
            Last Digits:{' '}
            <span className="italic font-bold text-white">{highlightedDigit}</span>
          </span>

          {/* Ticks selector */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 text-white font-semibold text-sm sm:text-base"
            >
              <span>{selectedTicks} ticks</span>
              <svg width="12" height="18" viewBox="0 0 12 18" fill="none">
                <path d="M2 7L6 3L10 7"    stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11L6 15L10 11" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 bg-[#1e2535] rounded-lg shadow-xl border border-[#2a3142] py-1 z-50 min-w-[110px]">
                {TICK_OPTIONS.map(tick => (
                  <button
                    key={tick}
                    onClick={() => { setSelectedTicks(tick); setIsDropdownOpen(false) }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-[#2a3142] transition-colors ${
                      selectedTicks === tick ? 'text-[#22d3ee]' : 'text-white'
                    }`}
                  >
                    {tick} ticks
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Gráfico */}
        <div className="px-2 pb-2" style={{ height: activeChart === 'bar' ? 260 : 230 }}>
          {activeChart === 'bar' ? (
            <DigitBarChart bars={bars} />
          ) : (
            <CandlestickChart candles={candleData} />
          )}
        </div>
      </div>
    </>
  )
}
