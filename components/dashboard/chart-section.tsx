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

// ── Constantes ────────────────────────────────────────────────────────────────

const TICK_OPTIONS  = [25, 50, 100, 250, 500, 1000]
const MAX_Y         = 35   // teto das barras (%)
const SVG_H_BAR     = 220
const SVG_H_CANDLE  = 230
const PLOT_T        = 24
const PLOT_B        = 28
const PLOT_H_BAR    = SVG_H_BAR - PLOT_T - PLOT_B

// Teto do candlestick: vela nunca ultrapassa X% da área de plot
const CANDLE_TOP_MARGIN = 12   // px reservados no topo

const COL = {
  normal:    '#c8cdd6',
  highlight: '#2d8a4e',
  low:       '#9b2335',
}

interface BarEntry { digit: number; percentage: number; isHighlight: boolean; isLow: boolean }
interface Candle    { x: number; o: number; h: number; l: number; c: number }

const FALLBACK_BARS: BarEntry[] = Array.from({ length: 10 }, (_, i) => ({
  digit:       i,
  percentage:  10,
  isHighlight: i === 2,
  isLow:       false,
}))

// ── Easing ────────────────────────────────────────────────────────────────────

function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4) }

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
      const gap  = 4
      const barW = Math.max(8, (W - gap * 11) / 10)

      bars.forEach((bar, i) => {
        // Lerp mais lento (6% por frame ≈ ~50 frames para convergir) → movimento visivelmente suave
        const prev = smoothRef.current[i]
        const next = prev + (bar.percentage - prev) * 0.06
        smoothRef.current[i] = next

        const pct  = next
        // Limitar altura: nunca ultrapassa o teto do plot
        const barH = Math.min(PLOT_H_BAR - 2, Math.max(2, (pct / MAX_Y) * PLOT_H_BAR))
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
          // Percentagem acima da barra, mas nunca acima do topo do SVG
          const labelY = Math.max(14, y - 3)
          ptxt.setAttribute('y', labelY.toFixed(1))
          ptxt.textContent = `${pct.toFixed(1)}%`
        }

        const ltxt = lblRefs.current[i]
        if (ltxt) ltxt.setAttribute('x', (x + barW / 2).toFixed(1))
      })

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [barsRef])

  return (
    <div ref={containerRef} style={{ width: '100%', height: SVG_H_BAR }}>
      <svg width="100%" height={SVG_H_BAR} style={{ overflow: 'visible' }}>
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i}>
            <rect ref={el => { rectRefs.current[i] = el }} rx="3" ry="3" />
            <text
              ref={el => { pctRefs.current[i] = el }}
              textAnchor="middle" fill="white" fontSize="10" fontWeight="500"
            />
          </g>
        ))}

        <line
          x1="0" y1={PLOT_T + PLOT_H_BAR}
          x2="100%" y2={PLOT_T + PLOT_H_BAR}
          stroke="#3a4255" strokeWidth="1"
        />

        {Array.from({ length: 10 }, (_, i) => (
          <text
            key={`d${i}`}
            ref={el => { lblRefs.current[i] = el }}
            y={SVG_H_BAR - 8}
            textAnchor="middle" fill="white" fontSize="13" fontWeight="700"
          >
            {i}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Candlestick — RAF, limite de topo, movimento suave ────────────────────────

function CandlestickChart({ candlesRef }: { candlesRef: React.MutableRefObject<Candle[]> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement | null>(null)
  const widthRef     = useRef(600)
  const rafRef       = useRef<number | null>(null)
  const lastLenRef   = useRef(0)
  const pad          = { top: CANDLE_TOP_MARGIN + 4, right: 10, bottom: 28, left: 48 }

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => { widthRef.current = e.contentRect.width })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const ns = 'http://www.w3.org/2000/svg'

    const draw = () => {
      const candles = candlesRef.current
      const svg     = svgRef.current

      if (!svg || candles.length === 0 || candles.length === lastLenRef.current) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastLenRef.current = candles.length

      const W     = widthRef.current
      const plotW = W - pad.left - pad.right
      const plotH = SVG_H_CANDLE - pad.top - pad.bottom

      const prices = candles.flatMap(c => [c.h, c.l])
      const rawMin = Math.min(...prices)
      const rawMax = Math.max(...prices)
      // Margem de 2% em cada extremo para que as sombras não toquem nas bordas
      const margin = (rawMax - rawMin) * 0.08 || 0.5
      const yMin   = rawMin - margin
      const yMax   = rawMax + margin
      const yRange = yMax - yMin || 1

      const candleW = Math.max(3, plotW / candles.length - 1.5)

      // toY clamped: nunca ultrapassa topo nem fundo do plot
      const toY = (v: number) => {
        const raw = pad.top + plotH - ((v - yMin) / yRange) * plotH
        return Math.max(pad.top, Math.min(pad.top + plotH, raw))
      }
      const toX = (i: number) => pad.left + (i / candles.length) * plotW + candleW / 2

      svg.setAttribute('viewBox', `0 0 ${W} ${SVG_H_CANDLE}`)
      while (svg.firstChild) svg.removeChild(svg.firstChild)

      // Clip path para garantir que nada escapa para fora da área de plot
      const defs = document.createElementNS(ns, 'defs')
      const clip = document.createElementNS(ns, 'clipPath')
      clip.setAttribute('id', 'plotClip')
      const clipRect = document.createElementNS(ns, 'rect')
      clipRect.setAttribute('x',      pad.left.toString())
      clipRect.setAttribute('y',      pad.top.toString())
      clipRect.setAttribute('width',  plotW.toString())
      clipRect.setAttribute('height', plotH.toString())
      clip.appendChild(clipRect)
      defs.appendChild(clip)
      svg.appendChild(defs)

      // Área de plot com clip
      const plotGroup = document.createElementNS(ns, 'g')
      plotGroup.setAttribute('clip-path', 'url(#plotClip)')

      // Grid
      ;[0, 0.25, 0.5, 0.75, 1].forEach(pct => {
        const val = yMin + pct * yRange
        const y   = pad.top + plotH - pct * plotH

        const ln = document.createElementNS(ns, 'line')
        ln.setAttribute('x1', pad.left.toString())
        ln.setAttribute('y1', y.toFixed(1))
        ln.setAttribute('x2', (W - pad.right).toString())
        ln.setAttribute('y2', y.toFixed(1))
        ln.setAttribute('stroke', '#2a3142')
        ln.setAttribute('stroke-width', '1')
        ln.setAttribute('stroke-dasharray', '2,2')
        svg.appendChild(ln)

        const tx = document.createElementNS(ns, 'text')
        tx.setAttribute('x',            (pad.left - 4).toString())
        tx.setAttribute('y',            (y + 4).toFixed(1))
        tx.setAttribute('text-anchor',  'end')
        tx.setAttribute('fill',         '#9ca3af')
        tx.setAttribute('font-size',    '9')
        tx.textContent = val.toFixed(2)
        svg.appendChild(tx)
      })

      // Candles (dentro do clip)
      candles.forEach((c, i) => {
        const bull  = c.c >= c.o
        const color = bull ? '#22c55e' : '#dc2626'
        const x     = toX(i)

        const wick = document.createElementNS(ns, 'line')
        wick.setAttribute('x1',           x.toFixed(1))
        wick.setAttribute('y1',           toY(c.h).toFixed(1))
        wick.setAttribute('x2',           x.toFixed(1))
        wick.setAttribute('y2',           toY(c.l).toFixed(1))
        wick.setAttribute('stroke',       color)
        wick.setAttribute('stroke-width', '1')
        plotGroup.appendChild(wick)

        const bodyTop = Math.min(toY(c.o), toY(c.c))
        const bodyH   = Math.max(1, Math.abs(toY(c.c) - toY(c.o)))
        const rect    = document.createElementNS(ns, 'rect')
        rect.setAttribute('x',      (x - candleW / 2).toFixed(1))
        rect.setAttribute('y',      bodyTop.toFixed(1))
        rect.setAttribute('width',  candleW.toFixed(1))
        rect.setAttribute('height', bodyH.toFixed(1))
        rect.setAttribute('fill',   color)
        rect.setAttribute('rx',     '0.5')
        plotGroup.appendChild(rect)
      })

      svg.appendChild(plotGroup)

      // Labels de tempo (fora do clip, na área de rodapé)
      const step = Math.ceil(candles.length / 8)
      candles.forEach((c, i) => {
        if (i % step !== 0) return
        const time = new Date(c.x).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
        const tx   = document.createElementNS(ns, 'text')
        tx.setAttribute('x',           toX(i).toFixed(1))
        tx.setAttribute('y',           (SVG_H_CANDLE - 8).toString())
        tx.setAttribute('text-anchor', 'middle')
        tx.setAttribute('fill',        '#9ca3af')
        tx.setAttribute('font-size',   '9')
        tx.textContent = time
        svg.appendChild(tx)
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [candlesRef, pad.bottom, pad.left, pad.right, pad.top])

  return (
    <div ref={containerRef} style={{ width: '100%', height: SVG_H_CANDLE }}>
      <svg ref={svgRef} width="100%" height={SVG_H_CANDLE} />
    </div>
  )
}

// ── Last Digits strip ─────────────────────────────────────────────────────────
// Mostra os últimos N dígitos recebidos com animação de entrada suave

const MAX_LAST_DIGITS = 18

function LastDigitsStrip({ digits }: { digits: number[] }) {
  return (
    <div className="flex items-center gap-1 overflow-hidden px-1">
      {digits.length === 0 ? (
        <span className="text-gray-600 text-[10px]">—</span>
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
                  ? 'w-6 h-6 text-sm bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40 scale-110'
                  : 'w-5 h-5 text-[11px] bg-[#1e2535] text-gray-300 border border-[#2a3142]'
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

  const [activeChart,    setActiveChart]    = useState<'bar' | 'candle'>('candle')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightDigit, setHighlightDigit] = useState<number | null>(null)
  const [lastDigits,     setLastDigits]     = useState<number[]>([])

  // Refs de dados — lidos pelo RAF sem causar re-renders
  const barsRef    = useRef<BarEntry[]>(FALLBACK_BARS)
  const candlesRef = useRef<Candle[]>([])

  // Sincronizar contexto → refs
  useEffect(() => {
    if (chartData?.barData?.length) {
      barsRef.current = chartData.barData
      const hi = chartData.barData.find(b => b.isHighlight)?.digit
      if (hi !== undefined) setHighlightDigit(hi)
    }
    if (chartData?.candleData?.length) candlesRef.current = chartData.candleData
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
      <div className="flex items-center justify-between px-3 py-2.5">
        {/* Toggles de gráfico */}
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

        {/* Título central */}
        <span className="text-white font-semibold text-sm sm:text-base tracking-wide">
          Last Digits
          {highlightDigit !== null && (
            <span className="ml-2 text-[#22c55e] font-bold italic">{highlightDigit}</span>
          )}
        </span>

        {/* Selector de ticks */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(o => !o)}
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

      {/* ── Gráfico ── */}
      <div className="px-2 pb-1">
        {activeChart === 'bar'
          ? <DigitBarChart    barsRef={barsRef}       />
          : <CandlestickChart candlesRef={candlesRef} />
        }
      </div>

      {/* ── Last Digits strip (substitui a aba "Último dígito") ── */}
      <div className="px-3 py-2 border-t border-[#2a3142] bg-[#0d1117]/40">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-[9px] font-bold uppercase tracking-widest shrink-0">
            Last Digits
          </span>
          <LastDigitsStrip digits={lastDigits} />
        </div>
      </div>

    </div>
  )
}
