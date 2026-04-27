'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTrading } from '@/lib/trading-context'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale, Filler } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'

// Registar componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale, Filler)

// Ícone de gráfico de barras customizado
function BarChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="10" width="4" height="8" rx="1" fill={active ? '#1a1f2e' : '#9ca3af'} />
      <rect x="8" y="6" width="4" height="12" rx="1" fill={active ? '#1a1f2e' : '#9ca3af'} />
      <rect x="14" y="2" width="4" height="16" rx="1" fill={active ? '#1a1f2e' : '#9ca3af'} />
    </svg>
  )
}

// Ícone de gráfico de linha/candlestick customizado
function CandleChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="6" width="3" height="8" rx="0.5" fill={active ? '#22c55e' : '#9ca3af'} />
      <line x1="4.5" y1="2" x2="4.5" y2="6" stroke={active ? '#22c55e' : '#9ca3af'} strokeWidth="1" />
      <line x1="4.5" y1="14" x2="4.5" y2="18" stroke={active ? '#22c55e' : '#9ca3af'} strokeWidth="1" />
      <rect x="8.5" y="4" width="3" height="10" rx="0.5" fill={active ? '#dc2626' : '#9ca3af'} />
      <line x1="10" y1="1" x2="10" y2="4" stroke={active ? '#dc2626' : '#9ca3af'} strokeWidth="1" />
      <line x1="10" y1="14" x2="10" y2="17" stroke={active ? '#dc2626' : '#9ca3af'} strokeWidth="1" />
      <rect x="14" y="5" width="3" height="7" rx="0.5" fill={active ? '#22c55e' : '#9ca3af'} />
      <line x1="15.5" y1="2" x2="15.5" y2="5" stroke={active ? '#22c55e' : '#9ca3af'} strokeWidth="1" />
      <line x1="15.5" y1="12" x2="15.5" y2="16" stroke={active ? '#22c55e' : '#9ca3af'} strokeWidth="1" />
    </svg>
  )
}

interface CandleData {
  x: number
  o: number
  h: number
  l: number
  c: number
}

export function ChartSection() {
  const { chartData, selectedTicks, setSelectedTicks, lastDigit: contextLastDigit } = useTrading()
  const [activeChart, setActiveChart] = useState<'bar' | 'candle'>('candle')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [candleData, setCandleData] = useState<CandleData[]>([])
  const [displayDigit, setDisplayDigit] = useState(2)
  const chartRef = useRef<ChartJS | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const tickOptions = [25, 50, 100, 250, 500, 1000]

  // Atualizar dados quando chartData muda
  useEffect(() => {
    if (chartData?.candleData && chartData.candleData.length > 0) {
      setCandleData(chartData.candleData)
    }
    if (chartData?.lastDigit !== undefined) {
      setDisplayDigit(chartData.lastDigit)
    }
  }, [chartData])

  // Usar lastDigit do contexto
  useEffect(() => {
    if (contextLastDigit !== undefined) {
      setDisplayDigit(contextLastDigit)
    }
  }, [contextLastDigit])

  // Dados fallback para barras
  const barData = chartData?.barData || [
    { digit: 0, percentage: 8.0, isHighlight: false, isLow: false },
    { digit: 1, percentage: 8.0, isHighlight: false, isLow: false },
    { digit: 2, percentage: 28.0, isHighlight: true, isLow: false },
    { digit: 3, percentage: 4.0, isHighlight: false, isLow: true },
    { digit: 4, percentage: 12.0, isHighlight: false, isLow: false },
    { digit: 5, percentage: 4.0, isHighlight: false, isLow: true },
    { digit: 6, percentage: 12.0, isHighlight: false, isLow: false },
    { digit: 7, percentage: 4.0, isHighlight: false, isLow: true },
    { digit: 8, percentage: 8.0, isHighlight: false, isLow: false },
    { digit: 9, percentage: 12.0, isHighlight: false, isLow: false },
  ]

  // Gerar dados de candlestick se não houver dados do servidor
  const generateMockCandles = useCallback((): CandleData[] => {
    const now = Date.now()
    const candles: CandleData[] = []
    let price = 950.00
    
    for (let i = 0; i < 60; i++) {
      const open = price
      const change = (Math.random() - 0.5) * 2
      const close = open + change
      const high = Math.max(open, close) + Math.random() * 0.5
      const low = Math.min(open, close) - Math.random() * 0.5
      
      candles.push({
        x: now - (60 - i) * 60000,
        o: open,
        h: high,
        l: low,
        c: close,
      })
      
      price = close
    }
    
    return candles
  }, [])

  // Inicializar candles se vazio
  useEffect(() => {
    if (candleData.length === 0) {
      setCandleData(generateMockCandles())
    }
  }, [candleData.length, generateMockCandles])

  // Encontrar último dígito mais frequente para barras
  const highlightedDigit = barData.find(d => d.isHighlight)?.digit ?? displayDigit

  // Configuração do gráfico de candlestick
  const candlestickConfig = {
    type: 'bar' as const,
    data: {
      labels: candleData.map(c => new Date(c.x).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })),
      datasets: [
        {
          label: 'Candlestick',
          data: candleData.map(c => ({
            x: c.x,
            y: [c.o, c.h, c.l, c.c],
          })),
          backgroundColor: candleData.map(c => c.c >= c.o ? 'rgba(34, 197, 94, 0.8)' : 'rgba(220, 38, 38, 0.8)'),
          borderColor: candleData.map(c => c.c >= c.o ? '#22c55e' : '#dc2626'),
          borderWidth: 1,
          barThickness: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1f2e',
          titleColor: '#fff',
          bodyColor: '#9ca3af',
          borderColor: '#374151',
          borderWidth: 1,
          callbacks: {
            label: (context: { raw: { y?: number[] } }) => {
              const data = context.raw as { y?: number[] }
              if (data?.y) {
                const [o, h, l, c] = data.y
                return [
                  `Open: ${o?.toFixed(2)}`,
                  `High: ${h?.toFixed(2)}`,
                  `Low: ${l?.toFixed(2)}`,
                  `Close: ${c?.toFixed(2)}`,
                ]
              }
              return ''
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#2a3142', drawBorder: false },
          ticks: { color: '#9ca3af', maxTicksLimit: 10 },
        },
        y: {
          grid: { color: '#2a3142', drawBorder: false },
          ticks: { color: '#9ca3af' },
          position: 'left' as const,
        },
      },
    },
  }

  // Configuração do gráfico de barras (percentual de dígitos)
  const barChartConfig = {
    type: 'bar' as const,
    data: {
      labels: barData.map(b => b.digit.toString()),
      datasets: [
        {
          label: 'Percentual',
          data: barData.map(b => b.percentage),
          backgroundColor: barData.map(b => 
            b.isHighlight ? '#22c55e' : b.isLow ? '#dc2626' : '#d1d5db'
          ),
          borderRadius: 4,
          barThickness: 32,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1f2e',
          titleColor: '#fff',
          bodyColor: '#9ca3af',
          callbacks: {
            label: (context: { parsed: { y: number } }) => `${context.parsed.y.toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { 
            color: '#fff', 
            font: { weight: 'bold' as const, size: 14 } 
          },
        },
        y: {
          grid: { color: '#2a3142', drawBorder: false },
          ticks: { 
            color: '#9ca3af',
            callback: (value: number | string) => `${value}%`,
          },
          max: 35,
        },
      },
    },
  }

  // Renderizar candlestick customizado
  const renderCandlestick = () => {
    const chartHeight = 220
    const chartWidth = containerRef.current?.clientWidth || 600
    const padding = { top: 15, right: 15, bottom: 35, left: 50 }
    const plotWidth = chartWidth - padding.left - padding.right
    const plotHeight = chartHeight - padding.top - padding.bottom
    
    if (candleData.length === 0) return null

    // Calcular escala Y
    const allPrices = candleData.flatMap(c => [c.h, c.l])
    const yMin = Math.min(...allPrices) - 0.5
    const yMax = Math.max(...allPrices) + 0.5
    const yRange = yMax - yMin || 1

    const candleWidth = Math.max(4, (plotWidth / candleData.length) - 2)

    return (
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const value = yMin + pct * yRange
          const y = padding.top + plotHeight - pct * plotHeight
          return (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="#2a3142"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fill="#9ca3af"
                fontSize="10"
              >
                {value.toFixed(2)}
              </text>
            </g>
          )
        })}

        {/* Candlesticks */}
        {candleData.map((candle, idx) => {
          const x = padding.left + (idx / candleData.length) * plotWidth + candleWidth / 2
          const isBullish = candle.c >= candle.o
          const color = isBullish ? '#22c55e' : '#dc2626'
          
          const yHigh = padding.top + plotHeight - ((candle.h - yMin) / yRange) * plotHeight
          const yLow = padding.top + plotHeight - ((candle.l - yMin) / yRange) * plotHeight
          const yOpen = padding.top + plotHeight - ((candle.o - yMin) / yRange) * plotHeight
          const yClose = padding.top + plotHeight - ((candle.c - yMin) / yRange) * plotHeight
          
          const bodyTop = Math.min(yOpen, yClose)
          const bodyHeight = Math.max(1, Math.abs(yClose - yOpen))

          return (
            <g key={idx}>
              {/* Wick (sombra) */}
              <line
                x1={x}
                y1={yHigh}
                x2={x}
                y2={yLow}
                stroke={color}
                strokeWidth="1"
              />
              {/* Body (corpo) */}
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                rx="1"
              />
            </g>
          )
        })}

        {/* Eixo X - timestamps */}
        {candleData.filter((_, i) => i % Math.ceil(candleData.length / 8) === 0).map((candle, idx) => {
          const actualIdx = candleData.indexOf(candle)
          const x = padding.left + (actualIdx / candleData.length) * plotWidth + candleWidth / 2
          const time = new Date(candle.x).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
          return (
            <text
              key={idx}
              x={x}
              y={chartHeight - 10}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="9"
            >
              {time}
            </text>
          )
        })}
      </svg>
    )
  }

  return (
    <div className="bg-[#1a1f2e] rounded-xl p-3 sm:p-4 border-2 border-[#2a3142] shadow-lg">
      {/* Header do gráfico */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {/* Botões de tipo de gráfico */}
          <button
            onClick={() => setActiveChart('bar')}
            className={`p-2 rounded-lg transition-all duration-200 ${
              activeChart === 'bar' 
                ? 'bg-white shadow-md' 
                : 'bg-transparent hover:bg-[#374151]'
            }`}
          >
            <BarChartIcon active={activeChart === 'bar'} />
          </button>
          <button
            onClick={() => setActiveChart('candle')}
            className={`p-2 rounded-lg transition-all duration-200 ${
              activeChart === 'candle' 
                ? 'bg-white shadow-md' 
                : 'bg-transparent hover:bg-[#374151]'
            }`}
          >
            <CandleChartIcon active={activeChart === 'candle'} />
          </button>
        </div>

        {/* Título e seletor de ticks */}
        <div className="flex items-center gap-3 sm:gap-6">
          <span className="text-white font-medium text-sm sm:text-base">
            Last Digits: <span className="font-bold text-[#22d3ee]">{highlightedDigit}</span>
          </span>
          
          {/* Dropdown de ticks */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 text-white font-medium text-sm sm:text-base"
            >
              <span>{selectedTicks} ticks</span>
              <div className="flex flex-col items-center">
                <svg width="8" height="5" viewBox="0 0 10 6" fill="none" className="-mb-0.5">
                  <path d="M1 5L5 1L9 5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <svg width="8" height="5" viewBox="0 0 10 6" fill="none" className="-mt-0.5">
                  <path d="M1 1L5 5L9 1" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
            
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 bg-[#2a3142] rounded-lg shadow-xl border-2 border-[#374151] py-1 z-50 min-w-[100px]">
                {tickOptions.map((tick) => (
                  <button
                    key={tick}
                    onClick={() => {
                      setSelectedTicks(tick)
                      setIsDropdownOpen(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-[#374151] transition-colors ${
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
      </div>

      {/* Área do gráfico */}
      <div ref={containerRef} className="relative h-[220px]">
        {activeChart === 'bar' ? (
          // Gráfico de Barras com Chart.js
          <Chart
            ref={chartRef}
            type="bar"
            data={barChartConfig.data}
            options={barChartConfig.options}
          />
        ) : (
          // Gráfico de Candlestick customizado
          <div className="w-full h-full">
            {renderCandlestick()}
          </div>
        )}
      </div>

      {/* Indicador de último dígito */}
      <div className="mt-3 flex items-center justify-center">
        <div className="bg-[#0a0e1a] rounded-lg px-4 py-2 border border-[#2a3142]">
          <span className="text-gray-400 text-xs mr-2">Último dígito:</span>
          <span className="text-[#22c55e] text-2xl font-bold">{displayDigit}</span>
        </div>
      </div>
    </div>
  )
}
