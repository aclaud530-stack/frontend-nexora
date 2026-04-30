'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const SYMBOL       = '1HZ100V'
const WS_URL       = 'wss://api.derivws.com/trading/v1/options/ws/public'
const TICK_OPTIONS = [25, 50, 100, 250, 500, 1000]
const DEFAULT_MAX  = 500
const MAX_LAST     = 20

// Visual constants
const SVG_H   = 240
const PLOT_T  = 32   // top padding (for percentage labels)
const PLOT_B  = 32   // bottom padding (for digit labels)
const PLOT_H  = SVG_H - PLOT_T - PLOT_B
const MAX_Y   = 35   // visual ceiling (%) — bars clip here but % label is still accurate

const COL = {
  normal:    '#9ca3af',
  highlight: '#22c55e',
  low:       '#dc2626',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BarEntry {
  digit:       number
  count:       number
  percentage:  number
  isHighlight: boolean
  isLow:       boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the last digit from a price string.
 * Uses the string representation to avoid floating-point issues.
 * e.g. "1234.56" → 6
 */
function lastDigitFromQuote(quote: number): number {
  const str = String(quote)
  for (let i = str.length - 1; i >= 0; i--) {
    const c = str[i]
    if (c >= '0' && c <= '9') return parseInt(c, 10)
  }
  return 0
}

function buildBars(counts: number[], total: number): BarEntry[] {
  let maxCount = 0
  let minCount = Infinity
  let maxIdx   = 0
  let minIdx   = 0

  for (let i = 0; i < 10; i++) {
    if (counts[i] > maxCount) { maxCount = counts[i]; maxIdx = i }
    if (counts[i] < minCount) { minCount = counts[i]; minIdx = i }
  }

  return Array.from({ length: 10 }, (_, d) => ({
    digit:       d,
    count:       counts[d],
    percentage:  total > 0 ? (counts[d] / total) * 100 : 10,
    isHighlight: d === maxIdx && total > 0,
    isLow:       d === minIdx && total > 0 && minCount < maxCount,
  }))
}

// ── Bar Chart (RAF-driven, zero React re-renders inside) ──────────────────────

function DigitBarChart({ barsRef }: { barsRef: React.MutableRefObject<BarEntry[]> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rectRefs     = useRef<(SVGRectElement | null)[]>(Array(10).fill(null))
  const pctRefs      = useRef<(SVGTextElement | null)[]>(Array(10).fill(null))
  const lblRefs      = useRef<(SVGTextElement | null)[]>(Array(10).fill(null))
  const widthRef     = useRef(360)
  const smoothRef    = useRef<number[]>(Array(10).fill(10))
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
        const prev = smoothRef.current[i]
        const next = prev + (bar.percentage - prev) * 0.08
        smoothRef.current[i] = next

        const barH = Math.min(PLOT_H - 4, Math.max(4, (Math.min(next, MAX_Y) / MAX_Y) * PLOT_H))
        const x    = gap + i * (barW + gap)
        const y    = PLOT_T + PLOT_H - barH
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
          ptxt.setAttribute('y', Math.max(18, y - 6).toFixed(1))
          ptxt.textContent = `${bar.percentage.toFixed(1)}%`
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
    <div ref={containerRef} style={{ width: '100%', height: SVG_H }}>
      <svg width="100%" height={SVG_H} style={{ overflow: 'visible' }}>
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i}>
            <rect ref={el => { rectRefs.current[i] = el }} rx="4" ry="4" />
            <text
              ref={el => { pctRefs.current[i] = el }}
              textAnchor="middle" fontSize="11" fontWeight="600"
            />
          </g>
        ))}

        <line
          x1="0" y1={PLOT_T + PLOT_H}
          x2="100%" y2={PLOT_T + PLOT_H}
          stroke="#3a4255" strokeWidth="1"
        />

        {Array.from({ length: 10 }, (_, i) => (
          <text
            key={`lbl${i}`}
            ref={el => { lblRefs.current[i] = el }}
            y={SVG_H - 8}
            textAnchor="middle" fill="white" fontSize="14" fontWeight="700"
          >
            {i}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Last Digits Strip ─────────────────────────────────────────────────────────

function LastDigitsStrip({ digits }: { digits: number[] }) {
  return (
    <div className="flex items-center gap-1.5 overflow-hidden px-1">
      {digits.length === 0 ? (
        <span className="text-gray-600 text-xs">Aguardando dados...</span>
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
              style={{ opacity: 0.4 + (i / digits.length) * 0.6 }}
            >
              {d}
            </span>
          )
        })
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ChartSection() {
  const [maxTicks,   setMaxTicks]   = useState(DEFAULT_MAX)
  const [isDropdown, setIsDropdown] = useState(false)
  const [lastDigits, setLastDigits] = useState<number[]>([])
  const [tickCount,  setTickCount]  = useState(0)
  const [topDigit,   setTopDigit]   = useState<number | null>(null)

  // Mutable state for WS logic — no re-renders
  const countsRef  = useRef<number[]>(Array(10).fill(0))
  const totalRef   = useRef(0)
  const queueRef   = useRef<number[]>([])
  const maxTickRef = useRef(maxTicks)
  const barsRef    = useRef<BarEntry[]>(buildBars(Array(10).fill(0), 0))
  const wsRef      = useRef<WebSocket | null>(null)

  // Keep maxTickRef in sync
  useEffect(() => {
    maxTickRef.current = maxTicks
    // Re-trim queue if window shrank
    const q = queueRef.current
    while (q.length > maxTicks) {
      const old = q.shift()!
      countsRef.current[old]--
      totalRef.current--
    }
    barsRef.current = buildBars(countsRef.current, totalRef.current)
  }, [maxTicks])

  const connectWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close()

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1, req_id: 1 }))
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.error) {
        console.error('Deriv WS error:', data.error.message)
        return
      }
      if (data.msg_type !== 'tick') return

      const digit = lastDigitFromQuote(data.tick.quote)
      const q     = queueRef.current
      const c     = countsRef.current

      // Sliding window
      q.push(digit)
      c[digit]++
      totalRef.current++

      if (q.length > maxTickRef.current) {
        const old = q.shift()!
        c[old]--
        totalRef.current--
      }

      // Update bars ref (read by RAF — no setState)
      const bars = buildBars(c, totalRef.current)
      barsRef.current = bars

      // Minimal React state updates (just counters + strip)
      const hi = bars.find(b => b.isHighlight)?.digit ?? null
      setTopDigit(hi)
      setTickCount(totalRef.current)
      setLastDigits(prev => {
        const next = [...prev, digit]
        return next.length > MAX_LAST ? next.slice(-MAX_LAST) : next
      })
    }

    ws.onerror = () => console.error('Deriv WS error')
    ws.onclose = () => {
      if (wsRef.current === ws) setTimeout(connectWS, 3000)
    }
  }, [])

  // Mount → connect; unmount → close
  useEffect(() => {
    connectWS()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connectWS])

  return (
    <div className="bg-[#131825] rounded-xl border border-[#2a3142] overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3142]">

        {/* Symbol + tick count */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs font-mono">{SYMBOL}</span>
          <span className="text-gray-600 text-xs">{tickCount} ticks</span>
        </div>

        {/* Most frequent digit */}
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm tracking-wide">
            Mais frequente:
          </span>
          {topDigit !== null && (
            <span className="text-[#22c55e] font-bold text-xl">{topDigit}</span>
          )}
        </div>

        {/* Tick window selector */}
        <div className="relative">
          <button
            onClick={() => setIsDropdown(o => !o)}
            className="flex items-center gap-2 text-white font-semibold text-sm bg-[#1e2535] hover:bg-[#2a3142] px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>{maxTicks} ticks</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`transition-transform ${isDropdown ? 'rotate-180' : ''}`}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="#9ca3af" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {isDropdown && (
            <div className="absolute right-0 top-full mt-2 bg-[#1e2535] rounded-lg shadow-xl border border-[#2a3142] py-1 z-50 min-w-[120px]">
              {TICK_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => { setMaxTicks(t); setIsDropdown(false) }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#2a3142] transition-colors ${
                    maxTicks === t ? 'text-[#22c55e] font-semibold' : 'text-white'
                  }`}
                >
                  {t} ticks
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="px-3 py-2">
        <DigitBarChart barsRef={barsRef} />
      </div>

      {/* ── Last Digits Strip ── */}
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
