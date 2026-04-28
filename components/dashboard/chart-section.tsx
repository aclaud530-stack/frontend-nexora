'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTrading } from '@/lib/trading-context'

// ── Ícones ────────────────────────────────────────────────────────────────────

function BarChartIcon({ active }: { active: boolean }) {
  const c = active ? '#1a1f2e' : '#9ca3af'
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="2"  y="10" width="4" height="8" rx="1" fill={c} />
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
      <rect x="3"   y="6"  width="3" height="8"  rx="0.5" fill={bull} />
      <line x1="4.5" y1="2"  x2="4.5" y2="6"  stroke={bull} strokeWidth="1" />
      <line x1="4.5" y1="14" x2="4.5" y2="18" stroke={bull} strokeWidth="1" />
      <rect x="8.5" y="4"  width="3" height="10" rx="0.5" fill={bear} />
      <line x1="10"  y1="1"  x2="10"  y2="4"  stroke={bear} strokeWidth="1" />
      <line x1="10"  y1="14" x2="10"  y2="17" stroke={bear} strokeWidth="1" />
      <rect x="14"  y="5"  width="3" height="7"  rx="0.5" fill={bull} />
      <line x1="15.5" y1="2"  x2="15.5" y2="5"  stroke={bull} strokeWidth="1" />
      <line x1="15.5" y1="12" x2="15.5" y2="16" stroke={bull} strokeWidth="1" />
    </svg>
  )
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

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

// ── Constantes ────────────────────────────────────────────────────────────────

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

// ── Gráfico de Barras Customizado ─────────────────────────────────────────────

function DigitBarChart({ bars }: { bars: BarEntry[] }) {
  const MAX_PCT = 35 // eixo Y máximo (igual à imagem)

  return (
    <div className="w-full h-full flex flex-col">
      {/* Área das barras */}
      <div className="flex-1 flex items-end gap-[3px] sm:gap-[5px] px-1 pb-0 min-h-0">
        {bars.map((bar) => {
          const heightPct = (bar.percentage / MAX_PCT) * 100
          const bgColor = bar.isHighlight
            ? '#2d8a4e'   // verde escuro igual à imagem
            : bar.isLow
              ? '#9b2335'  // vermelho escuro igual à imagem
              : '#c8cdd6'  // cinzento claro igual à imagem

          return (
            <div
              key={bar.digit}
              className="flex-1 flex flex-col items-center justify-end gap-[3px]"
              style={{ height: '100%' }}
            >
              {/* Percentagem acima da barra */}
              <span
                className="text-white font-medium leading-none"
                style={{ fontSize: 'clamp(8px, 1.8vw, 11px)' }}
              >
                {bar.percentage.toFixed(1)}%
              </span>
              {/* Barra */}
              <div
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: bgColor,
                  width: '100%',
                  borderRadius: '3px 3px 0 0',
                  minHeight: bar.percentage > 0 ? 6 : 0,
                  transition: 'height 0.4s ease',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Linha separadora */}
      <div className="h-px bg-[#3a4255] mx-1" />

      {/* Labels 0-9 */}
      <div className="flex gap-[3px] sm:gap-[5px] px-1 pt-1">
        {bars.map((bar) => (
          <div key={bar.digit} className="flex-1 flex items-center justify-center">
            <span
              className="text-white font-bold"
              style={{ fontSize: 'clamp(10px, 2vw, 14px)' }}
            >
              {bar.digit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Candlestick SVG ───────────────────────────────────────────────────────────

function CandlestickChart({ candles }: { candles: CandleData[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const H = 220
  const pad = { top: 15, right: 10, bottom: 30, left: 48 }
  const plotW = width - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  if (candles.length === 0) return <div ref={containerRef} className="w-full h-full" />

  const allPrices = candles.flatMap(c => [c.h, c.l])
  const yMin = Math.min(...allPrices) - 0.3
  const yMax = Math.max(...allPrices) + 0.3
  const yRange = yMax - yMin || 1
  const candleW = Math.max(3, plotW / candles.length - 1.5)

  const toY = (v: number) => pad.top + plotH - ((v - yMin) / yRange) * plotH
  const toX = (i: number) => pad.left + (i / candles.length) * plotW + candleW / 2

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
  const labelStep = Math.ceil(candles.length / 8)

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="xMidYMid meet">
        {gridLines.map((pct) => {
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

// ── Componente Principal ──────────────────────────────────────────────────────

export function ChartSection() {
  const { chartData, selectedTicks, setSelectedTicks, lastDigit: contextLastDigit } = useTrading()
  const [activeChart, setActiveChart] = useState<'bar' | 'candle'>('candle')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [candleData, setCandleData] = useState<CandleData[]>([])
  const [displayDigit, setDisplayDigit] = useState(2)

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
    let price = 950.0
    return Array.from({ length: 60 }, (_, i) => {
      const open = price
      const change = (Math.random() - 0.5) * 2
      const close = open + change
      price = close
      return {
        x: now - (60 - i) * 60000,
        o: open,
        h: Math.max(open, close) + Math.random() * 0.5,
        l: Math.min(open, close) - Math.random() * 0.5,
        c: close,
      }
    })
  }, [])

  useEffect(() => {
    if (candleData.length === 0) setCandleData(generateMockCandles())
  }, [candleData.length, generateMockCandles])

  const bars: BarEntry[] = chartData?.barData || FALLBACK_BARS
  const highlightedDigit = bars.find(d => d.isHighlight)?.digit ?? displayDigit

  return (
    <div className="bg-[#131825] rounded-xl border border-[#2a3142] overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#131825]">
        {/* Ícones esquerda */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveChart('bar')}
            className={`p-2 rounded-lg transition-all ${
              activeChart === 'bar' ? 'bg-white shadow' : 'hover:bg-[#1e2535]'
            }`}
          >
            <BarChartIcon active={activeChart === 'bar'} />
          </button>
          <button
            onClick={() => setActiveChart('candle')}
            className={`p-2 rounded-lg transition-all ${
              activeChart === 'candle' ? 'bg-white shadow' : 'hover:bg-[#1e2535]'
            }`}
          >
            <CandleChartIcon active={activeChart === 'candle'} />
          </button>
        </div>

        {/* Centro — Last Digits */}
        <span className="text-white font-semibold text-sm sm:text-base tracking-wide">
          Last Digits:{' '}
          <span className="italic font-bold text-white">{highlightedDigit}</span>
        </span>

        {/* Direita — ticks selector */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 text-white font-semibold text-sm sm:text-base"
          >
            <span>{selectedTicks} ticks</span>
            {/* Seta dupla igual à imagem */}
            <svg width="12" height="18" viewBox="0 0 12 18" fill="none">
              <path d="M2 7L6 3L10 7"  stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

      {/* ── Gráfico ── */}
      <div
        className="px-2 pb-2"
        style={{ height: activeChart === 'bar' ? 260 : 230 }}
      >
        {activeChart === 'bar' ? (
          <DigitBarChart bars={bars} />
        ) : (
          <CandlestickChart candles={candleData} />
        )}
      </div>

      {/* ── Último dígito (rodapé) ── */}
      <div className="flex items-center justify-center py-2 border-t border-[#2a3142]">
        <div className="bg-[#0a0e1a] rounded-lg px-5 py-1.5 border border-[#2a3142]">
          <span className="text-gray-400 text-xs mr-2">Último dígito:</span>
          <span className="text-[#22c55e] text-2xl font-bold">{displayDigit}</span>
        </div>
      </div>
    </div>
  )
}
