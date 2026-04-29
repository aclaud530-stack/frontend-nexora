'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
  colorChange?: boolean // verde se subir, vermelho se descer
}

export function AnimatedNumber({
  value,
  duration = 500,
  decimals = 2,
  prefix = '',
  suffix = '',
  className,
  colorChange = false,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [direction, setDirection] = useState<'up' | 'down' | 'neutral'>('neutral')
  const previousValue = useRef(value)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const startValue = previousValue.current
    const endValue = value
    const startTime = performance.now()

    // Determinar direção da mudança
    if (colorChange) {
      if (endValue > startValue) setDirection('up')
      else if (endValue < startValue) setDirection('down')
    }

    // Cancelar animação anterior
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function: easeOutExpo para movimento suave
      const easeOutExpo = 1 - Math.pow(2, -10 * progress)
      const currentValue = startValue + (endValue - startValue) * easeOutExpo

      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(endValue)
        previousValue.current = endValue
        // Reset direction after animation
        setTimeout(() => setDirection('neutral'), 300)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration, colorChange])

  const formattedValue = displayValue.toFixed(decimals)

  return (
    <span
      className={cn(
        'tabular-nums transition-colors duration-300',
        colorChange && direction === 'up' && 'text-emerald-400',
        colorChange && direction === 'down' && 'text-red-400',
        className
      )}
    >
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  )
}

// Componente para animar dígitos individualmente (para last digits)
interface AnimatedDigitProps {
  digit: number
  className?: string
}

export function AnimatedDigit({ digit, className }: AnimatedDigitProps) {
  const [currentDigit, setCurrentDigit] = useState(digit)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (digit !== currentDigit) {
      setIsAnimating(true)
      const timeout = setTimeout(() => {
        setCurrentDigit(digit)
        setIsAnimating(false)
      }, 150)
      return () => clearTimeout(timeout)
    }
  }, [digit, currentDigit])

  return (
    <span
      className={cn(
        'inline-block transition-all duration-150',
        isAnimating && 'scale-110 opacity-70',
        className
      )}
    >
      {currentDigit}
    </span>
  )
}
