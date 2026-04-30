'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const SYMBOL       = '1HZ100V'
const WS_URL       = 'wss://api.derivws.com/trading/v1/options/ws/public'
const TICK_OPTIONS = [25, 50, 100, 250, 500, 1000]
const DEFAULT_MAX  = 500

// Visual constants
const SVG_H  = 240
const PLOT_T = 28
const PLOT_B = 32
const PLOT_H = SVG_H - PLOT_T - PLOT_B
const MAX_Y  = 35

// Smoothing factor — 0.18 = responsive but not jittery (ideal for fast analysis)
const SMOOTH = 0.18

const COL = {
  normal:    '#4b5675',
  highlight: '#22c55e',
  low:       '#ef4444',
  text:      '#9ca3af',
}

// ── Shared State via BroadcastChannel + localStorage ─────────────────────────
// One tab acts as the WS master; others receive state via BroadcastChannel.
// On reload, state is restored from localStorage so bars never start from zero.

const STORAGE_KEY = 'nexora_digit_state'
const CHANNEL_KEY = 'nexora_ticks'

interface SharedState {
  counts:  number[]   // length 10
  queue:   number[]
  maxTicks: number
  lastDigit: number | null
}

function loadStoredState(maxTicks: number): SharedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SharedState
      if (
        Array.isArray(parsed.counts) && parsed.counts.length === 10 &&
        Array.isArray(parsed.queue)
      ) {
        // Re-trim queue to current maxTicks
        const q = parsed.queue.slice(-maxTicks)
        const c = Array(10).fill(0)
        q.forEach(d => c[d]++)
        return { counts: c, queue: q, maxTicks, lastDigit: parsed.lastDigit ?? null }
      }
    }
  } catch {}
  return { counts: Array(10).fill(0), queue: [], maxTicks, lastDigit: null }
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

// ── Bar Chart (RAF-driven) ────────────────────────────────────────────────────

function DigitBarChart({ barsRef }: { barsRef: React.MutableRefObject<BarEntry[]> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rectRefs     = useRef<(SVGRectElement | null)[]>(Array(10).fill(null))
  const pctRefs      = useRef<(SVGTextElement | null)[]>(Array(10).fill(null))
  const lblRefs      = useRef<(SVGTextElement | null)[]>(Array(10).fill(null))
  const widthRef     = useRef(360)
  const smoothRef    = useRef<number[]>(Array(10).fill(10))
  const rafRef       = useRef<number | null>(null)
  const prevFillRef  = useRef<string[]>(Array(10).fill(COL.normal))

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
      const gap  = 6
      const barW = Math.max(14, (W - gap * 11) / 10)

      bars.forEach((bar, i) => {
        const prev = smoothRef.current[i]
        const next = prev + (bar.percentage - prev) * SMOOTH
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
          if (prevFillRef.current[i] !== fill) {
            rect.setAttribute('fill', fill)
            prevFillRef.current[i] = fill
          }
        }

        const ptxt = pctRefs.current[i]
        if (ptxt) {
          ptxt.setAttribute('x', (x + barW / 2).toFixed(1))
          ptxt.setAttribute('y', Math.max(16, y - 5).toFixed(1))
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
            <rect ref={el => { rectRefs.current[i] = el }} rx="3" ry="3" />
            <text
              ref={el => { pctRefs.current[i] = el }}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fontFamily="monospace"
            />
          </g>
        ))}
        <line
          x1="0" y1={PLOT_T + PLOT_H}
          x2="100%" y2={PLOT_T + PLOT_H}
          stroke="#2a3142" strokeWidth="1"
        />
        {Array.from({ length: 10 }, (_, i) => (
          <text
            key={`lbl${i}`}
            ref={el => { lblRefs.current[i] = el }}
            y={SVG_H - 7}
            textAnchor="middle"
            fill="#6b7280"
            fontSize="13"
            fontWeight="700"
            fontFamily="monospace"
          >
            {i}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Current Digit Display ─────────────────────────────────────────────────────

function CurrentDigit({ digit }: { digit: number | null }) {
  const prevRef   = useRef<number | null>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (digit !== null && digit !== prevRef.current) {
      prevRef.current = digit
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 180)
      return () => clearTimeout(t)
    }
  }, [digit])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        minWidth: '56px',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          color: '#4b5675',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
          fontFamily: 'monospace',
        }}
      >
        DIGIT
      </span>
      <span
        style={{
          fontSize: '36px',
          fontWeight: 800,
          fontFamily: 'monospace',
          lineHeight: 1,
          color: digit === null ? '#2a3142' : '#22c55e',
          transform: flash ? 'scale(1.25)' : 'scale(1)',
          transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1), color 0.08s ease',
          display: 'inline-block',
          minWidth: '1ch',
          textAlign: 'center',
        }}
      >
        {digit !== null ? digit : '·'}
      </span>
    </div>
  )
}

// ── Connection Status Dot ─────────────────────────────────────────────────────

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: connected ? '#22c55e' : '#ef4444',
        boxShadow: connected ? '0 0 6px #22c55e88' : 'none',
        transition: 'background 0.3s, box-shadow 0.3s',
      }}
    />
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ChartSection() {
  const [maxTicks,    setMaxTicks]    = useState(DEFAULT_MAX)
  const [isDropdown,  setIsDropdown]  = useState(false)
  const [currentDigit, setCurrentDigit] = useState<number | null>(null)
  const [connected,   setConnected]   = useState(false)

  // Mutable refs — no re-renders for the hot path
  const countsRef   = useRef<number[]>(Array(10).fill(0))
  const totalRef    = useRef(0)
  const queueRef    = useRef<number[]>([])
  const maxTickRef  = useRef(maxTicks)
  const barsRef     = useRef<BarEntry[]>(buildBars(Array(10).fill(0), 0))
  const wsRef       = useRef<WebSocket | null>(null)
  const channelRef  = useRef<BroadcastChannel | null>(null)
  const isMasterRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Restore persisted state on mount ──────────────────────────────────────
  useEffect(() => {
    const stored = loadStoredState(maxTicks)
    countsRef.current = stored.counts
    queueRef.current  = stored.queue
    totalRef.current  = stored.queue.length
    barsRef.current   = buildBars(stored.counts, totalRef.current)
    if (stored.lastDigit !== null) setCurrentDigit(stored.lastDigit)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced persist to localStorage ─────────────────────────────────────
  const persistState = useCallback((lastDigit: number | null) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      try {
        const state: SharedState = {
          counts:   countsRef.current,
          queue:    queueRef.current,
          maxTicks: maxTickRef.current,
          lastDigit,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {}
    }, 400)
  }, [])

  // ── Process a new digit (called by master WS or by slave via BroadcastChannel)
  const processDigit = useCallback((digit: number) => {
    const q = queueRef.current
    const c = countsRef.current

    q.push(digit)
    c[digit]++
    totalRef.current++

    if (q.length > maxTickRef.current) {
      const old = q.shift()!
      c[old]--
      totalRef.current--
    }

    barsRef.current = buildBars(c, totalRef.current)
    setCurrentDigit(digit)
    persistState(digit)
  }, [persistState])

  // ── Keep maxTickRef in sync and trim queue ─────────────────────────────────
  useEffect(() => {
    maxTickRef.current = maxTicks
    const q = queueRef.current
    const c = countsRef.current
    while (q.length > maxTicks) {
      const old = q.shift()!
      c[old]--
      totalRef.current--
    }
    barsRef.current = buildBars(c, totalRef.current)
  }, [maxTicks])

  // ── WebSocket master logic ─────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close()

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1, req_id: 1 }))
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.error) return
      if (data.msg_type !== 'tick') return

      const digit = lastDigitFromQuote(data.tick.quote)

      // Broadcast to other tabs
      channelRef.current?.postMessage({ type: 'tick', digit })

      // Process locally
      processDigit(digit)
    }

    ws.onerror = () => { setConnected(false) }
    ws.onclose = () => {
      setConnected(false)
      // If still the master, reconnect
      if (isMasterRef.current && wsRef.current === ws) {
        setTimeout(connectWS, 2000)
      }
    }
  }, [processDigit])

  // ── BroadcastChannel + master election ────────────────────────────────────
  useEffect(() => {
    // Use BroadcastChannel for cross-tab state sync
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(CHANNEL_KEY)
      channelRef.current = channel
    } catch {
      // BroadcastChannel not supported — just go master
    }

    // Simple master election: first tab to post 'claim' wins.
    // Others listen; if master tab closes, next claimant after 3s wins.
    let masterTimeout: ReturnType<typeof setTimeout> | null = null

    const claimMaster = () => {
      isMasterRef.current = true
      channel?.postMessage({ type: 'master_claim' })
      connectWS()
    }

    if (channel) {
      channel.onmessage = (e) => {
        const msg = e.data
        if (msg.type === 'master_claim') {
          // Another tab claimed master — we become slave
          isMasterRef.current = false
          if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
          setConnected(true) // slave is "connected" via channel
          if (masterTimeout) clearTimeout(masterTimeout)
          // If master goes silent (closed), re-elect after 4s
          masterTimeout = setTimeout(claimMaster, 4000)
        } else if (msg.type === 'tick') {
          if (!isMasterRef.current) {
            processDigit(msg.digit)
            setConnected(true)
            // Reset master watchdog
            if (masterTimeout) clearTimeout(masterTimeout)
            masterTimeout = setTimeout(claimMaster, 4000)
          }
        } else if (msg.type === 'ping') {
          if (masterTimeout) clearTimeout(masterTimeout)
          masterTimeout = setTimeout(claimMaster, 4000)
        }
      }
    }

    // Attempt to become master immediately
    claimMaster()

    // Keepalive: master pings every 2s so slaves know it's alive
    const pingInterval = setInterval(() => {
      if (isMasterRef.current) {
        channel?.postMessage({ type: 'ping' })
      }
    }, 2000)

    return () => {
      clearInterval(pingInterval)
      if (masterTimeout) clearTimeout(masterTimeout)
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
      channel?.close()
      channelRef.current = null
    }
  }, [connectWS, processDigit])

  return (
    <div
      style={{
        background: '#0f1420',
        borderRadius: '12px',
        border: '1px solid #1e2535',
        overflow: 'hidden',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid #1e2535',
        }}
      >
        {/* Symbol + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusDot connected={connected} />
          <span style={{ color: '#6b7280', fontSize: '11px', letterSpacing: '0.05em' }}>
            {SYMBOL}
          </span>
        </div>

        {/* Current digit display — center */}
        <CurrentDigit digit={currentDigit} />

        {/* Tick window selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsDropdown(o => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#e5e7eb',
              fontSize: '12px',
              fontWeight: 600,
              background: '#1a2030',
              border: '1px solid #2a3142',
              padding: '5px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span>{maxTicks}T</span>
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{
                transform: isDropdown ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="#6b7280" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {isDropdown && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '6px',
                background: '#1a2030',
                borderRadius: '8px',
                border: '1px solid #2a3142',
                padding: '4px 0',
                zIndex: 50,
                minWidth: '100px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {TICK_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => { setMaxTicks(t); setIsDropdown(false) }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: maxTicks === t ? 700 : 400,
                    color: maxTicks === t ? '#22c55e' : '#d1d5db',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t} ticks
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Chart ── */}
      <div style={{ padding: '4px 12px 8px' }}>
        <DigitBarChart barsRef={barsRef} />
      </div>
    </div>
  )
}
