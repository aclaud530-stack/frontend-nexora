'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Chart,
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
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

// ── Constants ────────────────────────────────────────────────────────────────
const SYMBOL       = '1HZ100V'
const WS_URL       = 'wss://api.derivws.com/trading/v1/options/ws/public'
const TICK_OPTIONS = [25, 50, 100, 250, 500, 1000]
const DEFAULT_MAX  = 25
const MAX_LAST     = 20

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
  return counts.map(c => (total > 0 ? (c / total) * 100 : 0))
}

function barColors(percentages: number[]): string[] {
  return percentages.map(p => {
    if (p >= 20) return '#1db954'
    if (p <= 5)  return '#e63946'
    return '#b0b3b8'
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
      ctx.fillStyle  = '#fff'
      ctx.font       = '10px Arial'
      ctx.textAlign  = 'center'
      ctx.fillText(`${value.toFixed(1)}%`, bar.x, bar.y - 5)
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
  const [lastDigit,  setLastDigit]  = useState<number | null>(null)

  const canvasRef  = useRef<HTMLCanvasElement | null>(null)
  const chartRef   = useRef<Chart<'bar'> | null>(null)
  const countsRef  = useRef<number[]>(Array(10).fill(0))
  const queueRef   = useRef<number[]>([])
  const maxTickRef = useRef(maxTicks)
  const wsRef      = useRef<WebSocket | null>(null)

  // ── Build / destroy Chart.js instance ─────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return

    const initialData: ChartData<'bar'> = {
      labels: ['0','1','2','3','4','5','6','7','8','9'],
      datasets: [{
        data: Array(10).fill(0) as number[],
        borderRadius: 6,
        backgroundColor: Array(10).fill('#888') as string[],
      }],
    }

    // Explicit generic <'bar'> on both the config type and the constructor
    // avoids the "keyof ChartTypeRegistry is not assignable to 'bar'" TS error
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: initialData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        plugins: {
          legend:  { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: {
            ticks: { color: '#aaa', font: { size: 10 } },
            grid:  { display: false },
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

  // ── Chart.js update helper ─────────────────────────────────────────────────
  const updateChart = useCallback((percentages: number[]) => {
    const chart = chartRef.current
    if (!chart) return
    const maxValue = Math.max(...percentages)
    // Cast to concrete scale type to set max dynamically
    const yScale = chart.options.scales?.y as (Partial<LinearScaleOptions> & { max?: number }) | undefined
    if (yScale) yScale.max = maxValue + 10
    chart.data.datasets[0].data            = percentages
    chart.data.datasets[0].backgroundColor = barColors(percentages) as string[]
    chart.update()
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
    updateChart(computePercentages(c, total))
    setTickCount(total)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxTicks])

  // ── WebSocket connection ───────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close()

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1, req_id: 1 }))
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data as string) as {
        error?:    { message: string }
        msg_type?: string
        tick?:     { quote: number }
      }

      if (data.error) {
        console.error('Deriv WS error:', data.error.message)
        return
      }
      if (data.msg_type !== 'tick' || !data.tick) return

      const digit = lastDigitFromQuote(data.tick.quote)
      const q     = queueRef.current
      const c     = countsRef.current

      q.push(digit)
      c[digit]++

      if (q.length > maxTickRef.current) {
        const old = q.shift()!
        c[old]--
      }

      const total = q.length
      updateChart(computePercentages(c, total))

      setLastDigit(digit)
      setTickCount(total)
      setLastDigits(prev => {
        const next = [...prev, digit]
        return next.length > MAX_LAST ? next.slice(-MAX_LAST) : next
      })
    }

    ws.onerror = () => console.error('Deriv WS connection error')
    ws.onclose = () => {
      if (wsRef.current === ws) setTimeout(connectWS, 3000)
    }
  }, [updateChart])

  // ── Mount → connect; unmount → close ──────────────────────────────────────
  useEffect(() => {
    connectWS()
    return () => {
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connectWS])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#131825] rounded-xl border border-[#2a3142] overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3142]">

        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-xs font-mono">{SYMBOL}</span>
          <span className="text-gray-400 text-xs">
            Last Digit:{' '}
            <span className="text-white font-bold text-sm">
              {lastDigit !== null ? lastDigit : '-'}
            </span>
          </span>
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
      <div className="px-3 py-2" style={{ height: 200 }}>
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
