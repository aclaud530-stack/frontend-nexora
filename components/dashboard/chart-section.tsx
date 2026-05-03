'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type Plugin,
  type ChartData,
  type ChartConfiguration,
  type LinearScaleOptions,
} from 'chart.js'

// ── Register Chart.js modules ────────────────────────────────────────────────
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

// ── Constants ────────────────────────────────────────────────────────────────
const SYMBOL       = '1HZ100V'
const WS_URL       = 'wss://api.derivws.com/trading/v1/options/ws/public'
const TICK_OPTIONS = [25, 50, 100, 250, 500, 1000]
const DEFAULT_MAX  = 500   // large window → all bars always move
const MAX_LAST     = 20

// Smoothing: how fast bars animate toward target (0.0 = frozen, 1.0 = instant)
// 0.12 = smooth but snappy enough for fast trading analysis
const SMOOTH_FACTOR = 0.12

// ── Helpers ───────────────────────────────────────────────────────────────────
function lastDigitFromQuote(quote: number): number {
  const str = String(quote)
  for (let i = str.length - 1; i >= 0; i--) {
    const c = str[i]
    if (c >= '0' && c <= '9') return parseInt(c, 10)
  }
  return 0
}

function computePercentages(counts: number[], total: number): number[] {
  // Always return 10 values so every bar has a non-zero base to animate from
  if (total === 0) return Array(10).fill(10) // equal distribution when no data yet
  return counts.map(c => (c / total) * 100)
}

function barColors(percentages: number[]): string[] {
  const max = Math.max(...percentages)
  const min = Math.min(...percentages)
  return percentages.map(p => {
    if (p === max) return '#1db954'  // highest — green
    if (p === min) return '#e63946'  // lowest  — red
    return '#4a5568'                  // normal  — neutral grey
  })
}

// ── Percentage label plugin ───────────────────────────────────────────────────
const percentagePlugin: Plugin<'bar'> = {
  id: 'percentagePlugin',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart
    ctx.save()
    data.datasets[0].data.forEach((value, index) => {
      const meta = chart.getDatasetMeta(0)
      const bar  = meta.data[index]
      if (!bar || typeof value !== 'number') return
      ctx.fillStyle   = '#e2e8f0'
      ctx.font        = 'bold 10px monospace'
      ctx.textAlign   = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${value.toFixed(1)}%`, bar.x, bar.y - 2)
    })
    ctx.restore()
  },
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
                transition-all duration-150
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
  const [lastDigit,  setLastDigit]  = useState<number | null>(null)
  const canvasRef    = useRef<HTMLCanvasElement | null>(null)
  const chartRef     = useRef<Chart<'bar'> | null>(null)
  const countsRef    = useRef<number[]>(Array(10).fill(0))
  const queueRef     = useRef<number[]>([])
  const maxTickRef   = useRef(maxTicks)
  const wsRef        = useRef<WebSocket | null>(null)
  const rafRef       = useRef<number | null>(null)
  const smoothRef    = useRef<number[]>(Array(10).fill(10)) // start at equal 10%
  const targetRef    = useRef<number[]>(Array(10).fill(10))
  const reconnTimRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Build Chart.js instance ──────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return

    const initialData: ChartData<'bar'> = {
      labels: ['0','1','2','3','4','5','6','7','8','9'],
      datasets: [{
        data: Array(10).fill(10) as number[],
        borderRadius: 4,
        borderSkipped: false,
        backgroundColor: Array(10).fill('#4a5568') as string[],
        // No Chart.js animation — we drive it ourselves via RAF
        animation: false as unknown as object,
      }],
    }

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: initialData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // Disable all Chart.js animations — RAF loop handles smoothing
        animation: false,
        transitions: {},
        plugins: {
          legend:  { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: {
            ticks: {
              color: '#94a3b8',
              font: { size: 11, weight: 'bold', family: 'monospace' },
            },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            display:     false,
            beginAtZero: true,
            max:         40,
          },
        },
      },
      plugins: [percentagePlugin],
    }

    chartRef.current = new Chart<'bar'>(canvasRef.current, config)

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [])

  // ── RAF smoothing loop — runs independently of React renders ─────────────
  useEffect(() => {
    const loop = () => {
      const chart = chartRef.current
      if (chart) {
        const smooth  = smoothRef.current
        const targets = targetRef.current
        let   dirty   = false

        for (let i = 0; i < 10; i++) {
          const diff = targets[i] - smooth[i]
          // Only update if delta is meaningful (avoids infinite micro-updates)
          if (Math.abs(diff) > 0.005) {
            smooth[i] += diff * SMOOTH_FACTOR
            dirty = true
          } else {
            smooth[i] = targets[i]
          }
        }

        if (dirty) {
          const maxVal = Math.max(...smooth)
          const minVal = Math.min(...smooth)

          chart.data.datasets[0].data = [...smooth]
          chart.data.datasets[0].backgroundColor = smooth.map(v => {
            if (Math.abs(v - maxVal) < 0.01) return '#1db954'
            if (Math.abs(v - minVal) < 0.01) return '#e63946'
            return '#4a5568'
          }) as string[]

          // Dynamic Y ceiling: keeps bars from touching the top
          const yScale = chart.options.scales?.y as (Partial<LinearScaleOptions> & { max?: number }) | undefined
          if (yScale) yScale.max = maxVal + 8

          chart.update('none') // 'none' = skip Chart.js animation, just redraw
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── Keep maxTickRef in sync + trim queue on window change ──────────────────
  useEffect(() => {
    maxTickRef.current = maxTicks
    const q = queueRef.current
    const c = countsRef.current
    while (q.length > maxTicks) {
      const old = q.shift()!
      c[old]--
    }
    const total = q.length
    targetRef.current = computePercentages(c, total)
    setTickCount(total)
  }, [maxTicks])

  // ── WebSocket — persistent, auto-reconnect ─────────────────────────────────
  const connectWS = useCallback(() => {
    // Clear any pending reconnect timer
    if (reconnTimRef.current) {
      clearTimeout(reconnTimRef.current)
      reconnTimRef.current = null
    }

    // Close existing socket cleanly
    if (wsRef.current) {
      wsRef.current.onclose = null  // prevent reconnect loop on manual close
      wsRef.current.close()
      wsRef.current = null
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      // Subscribe to real-time ticks
      ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1, req_id: 1 }))

      // Keep-alive ping every 30s (Deriv closes idle connections)
      const pingId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: 1 }))
        } else {
          clearInterval(pingId)
        }
      }, 30_000)

      // Store pingId so we can clear on close
      ;(ws as WebSocket & { _pingId?: ReturnType<typeof setInterval> })._pingId = pingId
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data as string) as {
        error?:    { message: string }
        msg_type?: string
        tick?:     { quote: number }
      }

      if (data.error) {
        console.error('[Deriv WS] error:', data.error.message)
        return
      }

      // Ignore pong and subscription confirmation
      if (data.msg_type !== 'tick' || !data.tick) return

      const digit = lastDigitFromQuote(data.tick.quote)
      const q     = queueRef.current
      const c     = countsRef.current

      // FIFO sliding window
      q.push(digit)
      c[digit]++

      if (q.length > maxTickRef.current) {
        const old = q.shift()!
        c[old]--
      }

      const total = q.length

      // Push new targets to RAF loop — all 10 bars get new values every tick
      targetRef.current = computePercentages(c, total)

      // Minimal React state updates (only UI labels)
      setLastDigit(digit)
      setTickCount(total)
      setLastDigits(prev => {
        const next = [...prev, digit]
        return next.length > MAX_LAST ? next.slice(-MAX_LAST) : next
      })
    }

    ws.onerror = (err) => {
      console.error('[Deriv WS] connection error', err)
    }

    ws.onclose = () => {
      const ws_ = ws as WebSocket & { _pingId?: ReturnType<typeof setInterval> }
      if (ws_._pingId) clearInterval(ws_._pingId)

      // Only reconnect if this is still the active socket
      if (wsRef.current === ws) {
        console.warn('[Deriv WS] disconnected — reconnecting in 2s…')
        reconnTimRef.current = setTimeout(connectWS, 2_000)
      }
    }
  }, [])

  // ── Mount → connect; unmount → close ──────────────────────────────────────
  useEffect(() => {
    connectWS()
    return () => {
      if (reconnTimRef.current) clearTimeout(reconnTimRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connectWS])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#131825] rounded-xl border border-[#2a3142] overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3142]">

        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs font-mono">{SYMBOL}</span>
          <span className="text-gray-600 text-xs">{tickCount} ticks</span>
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
      <div className="px-3 py-2" style={{ height: 210 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
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
