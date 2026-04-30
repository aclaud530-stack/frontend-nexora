'use client'

import { useState, useEffect, useRef } from 'react'
import { useTrading } from '@/lib/trading-context'

// ── Ícones ────────────────────────────────────────────────────────────────────

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

function LineChartIcon({ active }: { active: boolean }) {
  const c = active ? '#1a1f2e' : '#9ca3af'
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 16l5-5 4 4 7-9" />
    </svg>
  )
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TICK_OPTIONS  = [25, 50, 100, 250, 500, 1000]
const MAX_Y         = 35   // teto das barras (%)
const SVG_H_BAR     = 240
const PLOT_T        = 32   // topo do plot (espaço para percentagens)
const PLOT_B        = 32   // fundo do plot (espaço para labels)
const PLOT_H_BAR    = SVG_H_BAR - PLOT_T - PLOT_B

const COL = {
  normal:    '#9ca3af',  // cinza claro (conforme screenshot)
  highlight: '#22c55e',  // verde para o mais frequente
  low:       '#dc2626',  // vermelho para os menos frequentes
}

interface BarEntry { digit: number; percentage: number; isHighlight: boolean; isLow: boolean }

const FALLBACK_BARS: BarEntry[] = Array.from({ length: 10 }, (_, i) => ({
  digit:       i,
  percentage:  10,
  isHighlight: i === 2,
  isLow:       false,
}))

// ── Gráfico de Barras — RAF puro, zero re-renders ─────────────────────────────

function DigitBarChart({ barsRef }: { barsRef: React.MutableRefObject<BarEntry[]> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rectRefs     = useRef<(SVGRectElement | null)[]>(Array(10).fill(null))
  const pctRefs      = useRef<(SVGTextElement | null)[]>(Array(10).fill(null))
  const lblRefs      = useRef<(SVGTextElement | null)[]>(Array(10).fill(null))
  const widthRef     = useRef(360)
  const smoothRef    = useRef<number[]>(FALLBACK_BARS.map(b => b.percentage))
  const rafRef       = useRef<number | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => { widthRef.current = e.contentRect.width })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const loop = () => {
      const bars = barsRef.current
      const W    = widthRef.current
      const gap  = 8
      const barW = Math.max(16, (W - gap * 11) / 10)

      bars.forEach((bar, i) => {
        // Lerp suave (8% por frame)
        const prev = smoothRef.current[i]
        const next = prev + (bar.percentage - prev) * 0.08
        smoothRef.current[i] = next

        const pct  = next
        const barH = Math.min(PLOT_H_BAR - 4, Math.max(4, (pct / MAX_Y) * PLOT_H_BAR))
        const x    = gap + i * (barW + gap)
        const y    = PLOT_T + PLOT_H_BAR - barH
        const fill = bar.isHighlight ? COL.highlight : bar.isLow ? COL.low : COL.normal

        const rect = rectRefs.current[i]
        if (rect) {
          rect.setAttribute('x',      x.toFixed(1))
          rect.setAttribute('y',      y.toFixed(1))
          rect.setAttribute('width',  barW.toFixed(1))
          rect.setAttribute('height', barH.toFixed(1))
          rect.setAttribute('fill',   fill)
        }

        const ptxt = pctRefs.current[i]
        if (ptxt) {
          ptxt.setAttribute('x', (x + barW / 2).toFixed(1))
          const labelY = Math.max(18, y - 6)
          ptxt.setAttribute('y', labelY.toFixed(1))
          ptxt.textContent = `${pct.toFixed(1)}%`
          ptxt.setAttribute('fill', fill)
        }

        const ltxt = lblRefs.current[i]
        if (ltxt) {
          ltxt.setAttribute('x', (x + barW / 2).toFixed(1))
        }
      })

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [barsRef])

  return (
    <div ref={containerRef} style={{ width: '100%', height: SVG_H_BAR }}>
      <svg width="100%" height={SVG_H_BAR} style={{ overflow: 'visible' }}>
        {/* Barras */}
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i}>
            <rect ref={el => { rectRefs.current[i] = el }} rx="4" ry="4" />
            <text
              ref={el => { pctRefs.current[i] = el }}
              textAnchor="middle" fontSize="11" fontWeight="600"
            />
          </g>
        ))}

        {/* Linha base */}
        <line
          x1="0" y1={PLOT_T + PLOT_H_BAR}
          x2="100%" y2={PLOT_T + PLOT_H_BAR}
          stroke="#3a4255" strokeWidth="1"
        />

        {/* Labels 0-9 */}
        {Array.from({ length: 10 }, (_, i) => (
          <text
            key={`d${i}`}
            ref={el => { lblRefs.current[i] = el }}
            y={SVG_H_BAR - 8}
            textAnchor="middle" fill="white" fontSize="14" fontWeight="700"
          >
            {i}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Last Digits strip ─────────────────────────────────────────────────────────

const MAX_LAST_DIGITS = 20

function LastDigitsStrip({ digits }: { digits: number[] }) {
  return (
    <div className="flex items-center gap-1.5 overflow-hidden px-1">
      {digits.length === 0 ? (
        <span className="text-gray-600 text-xs">A aguardar dados...</span>
      ) : (
        digits.map((d, i) => {
          const isNewest = i === digits.length - 1
          return (
            <span
              key={i}
              className={`
                inline-flex items-center justify-center rounded font-bold tabular-nums
                transition-all duration-300
                ${isNewest
                  ? 'w-7 h-7 text-sm bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/50 scale-110'
                  : 'w-6 h-6 text-xs bg-[#1e2535] text-gray-300 border border-[#2a3142]'
                }
              `}
              style={{
                opacity: 0.4 + (i / digits.length) * 0.6,
              }}
            >
              {d}
            </span>
          )
        })
      )}
    </div>
  )
}

// ── Componente Principal ──────────────────────────────────────────────────────

export function ChartSection() {
  const { chartData, selectedTicks, setSelectedTicks, lastDigit: ctxDigit } = useTrading()

  const [activeView,     setActiveView]     = useState<'bar' | 'line'>('bar')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightDigit, setHighlightDigit] = useState<number | null>(null)
  const [lastDigits,     setLastDigits]     = useState<number[]>([])

  // Refs de dados — lidos pelo RAF sem causar re-renders
  const barsRef = useRef<BarEntry[]>(FALLBACK_BARS)

  // Sincronizar contexto → refs
  useEffect(() => {
    if (chartData?.barData?.length) {
      barsRef.current = chartData.barData
      const hi = chartData.barData.find(b => b.isHighlight)?.digit
      if (hi !== undefined) setHighlightDigit(hi)
    }
  }, [chartData])

  // Acumular últimos dígitos
  useEffect(() => {
    if (ctxDigit === undefined || ctxDigit === null) return
    setLastDigits(prev => {
      const next = [...prev, ctxDigit]
      return next.length > MAX_LAST_DIGITS ? next.slice(-MAX_LAST_DIGITS) : next
    })
  }, [ctxDigit])

  return (
    <div className="bg-[#131825] rounded-xl border border-[#2a3142] overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3142]">
        {/* Toggles de visualização */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveView('bar')}
            className={`p-2 rounded-lg transition-all duration-200 ${
              activeView === 'bar' ? 'bg-white shadow-md' : 'hover:bg-[#1e2535]'
            }`}
            title="Gráfico de Barras"
          >
            <BarChartIcon active={activeView === 'bar'} />
          </button>
          <button
            onClick={() => setActiveView('line')}
            className={`p-2 rounded-lg transition-all duration-200 ${
              activeView === 'line' ? 'bg-white shadow-md' : 'hover:bg-[#1e2535]'
            }`}
            title="Gráfico de Linha"
          >
            <LineChartIcon active={activeView === 'line'} />
          </button>
        </div>

        {/* Título central com último dígito destacado */}
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-base tracking-wide">
            Last Digits:
          </span>
          {highlightDigit !== null && (
            <span className="text-[#22c55e] font-bold text-xl">{highlightDigit}</span>
          )}
        </div>

        {/* Selector de ticks */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(o => !o)}
            className="flex items-center gap-2 text-white font-semibold text-base bg-[#1e2535] hover:bg-[#2a3142] px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>{selectedTicks} ticks</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 bg-[#1e2535] rounded-lg shadow-xl border border-[#2a3142] py-1 z-50 min-w-[120px]">
              {TICK_OPTIONS.map(tick => (
                <button
                  key={tick}
                  onClick={() => { setSelectedTicks(tick); setIsDropdownOpen(false) }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#2a3142] transition-colors ${
                    selectedTicks === tick ? 'text-[#22c55e] font-semibold' : 'text-white'
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
      <div className="px-3 py-2">
        {activeView === 'bar' ? (
          <DigitBarChart barsRef={barsRef} />
        ) : (
          <div className="h-[240px] flex items-center justify-center text-gray-500 text-sm">
            <div className="text-center">
              <LineChartIcon active={false} />
              <p className="mt-2">Gráfico de linha em desenvolvimento</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Last Digits strip ── */}
      <div className="px-4 py-3 border-t border-[#2a3142] bg-[#0d1117]/50">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest shrink-0">
            Histórico
          </span>
          <LastDigitsStrip digits={lastDigits} />
        </div>
      </div>

    </div>
  )
}
