'use client'

import { useEffect, useState } from 'react'

interface LoaderProps {
  isVisible: boolean
  text?: string
  progress?: number
}

export function Loader({ isVisible, text = 'A carregar...', progress }: LoaderProps) {
  const [internalProgress, setInternalProgress] = useState(0)

  useEffect(() => {
    if (isVisible && progress === undefined) {
      const steps = [10, 25, 42, 58, 70, 80, 89, 94]
      let i = 0
      const interval = setInterval(() => {
        if (i < steps.length) {
          setInternalProgress(steps[i])
          i++
        } else {
          clearInterval(interval)
        }
      }, 260)
      return () => clearInterval(interval)
    }
  }, [isVisible, progress])

  useEffect(() => {
    if (progress !== undefined) {
      setInternalProgress(progress)
    }
  }, [progress])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-[18px] bg-[rgba(6,10,24,0.9)] backdrop-blur-[12px] animate-fade-in">
      {/* Logo */}
      <div 
        className="text-[17px] font-bold tracking-[5px]"
        style={{ 
          fontFamily: 'Orbitron, sans-serif',
          background: 'linear-gradient(135deg, #fff, #2ec7ff, #fff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}
      >
        NEXORA
      </div>

      {/* Spinner */}
      <div className="relative w-[58px] h-[58px]">
        {/* Outer ring */}
        <div 
          className="absolute inset-0 rounded-full animate-spin"
          style={{ 
            border: '2px solid transparent',
            borderTopColor: '#2ec7ff',
            borderRightColor: 'rgba(46, 199, 255, 0.2)',
            animationDuration: '0.9s'
          }}
        />
        {/* Inner ring */}
        <div 
          className="absolute inset-[9px] rounded-full animate-spin"
          style={{ 
            border: '2px solid transparent',
            borderBottomColor: '#0077ff',
            borderLeftColor: 'rgba(0, 119, 255, 0.2)',
            animationDuration: '0.7s',
            animationDirection: 'reverse'
          }}
        />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="w-[7px] h-[7px] rounded-full animate-pulse"
            style={{ 
              background: '#2ec7ff',
              boxShadow: '0 0 10px #2ec7ff, 0 0 20px rgba(46, 199, 255, 0.33)'
            }}
          />
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-[140px] h-[2px] bg-[#0e1525] rounded overflow-hidden">
        <div 
          className="h-full rounded transition-all duration-400"
          style={{ 
            width: `${internalProgress}%`,
            background: 'linear-gradient(90deg, #0077ff, #2ec7ff)',
            boxShadow: '0 0 8px rgba(46, 199, 255, 0.53)'
          }}
        />
      </div>

      {/* Text */}
      <div 
        className="text-[11px] font-medium tracking-[2px] uppercase animate-pulse"
        style={{ 
          fontFamily: 'Inter, sans-serif',
          color: '#3b4a6b'
        }}
      >
        {text}
      </div>
    </div>
  )
}

// Context para uso global do loader
import { createContext, useContext, ReactNode } from 'react'

interface LoaderContextType {
  show: (text?: string) => void
  hide: () => void
  complete: (text?: string) => void
  setText: (text: string) => void
}

const LoaderContext = createContext<LoaderContextType | undefined>(undefined)

export function LoaderProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)
  const [text, setText] = useState('A carregar...')
  const [progress, setProgress] = useState<number | undefined>(undefined)

  const show = (newText?: string) => {
    setText(newText || 'A carregar...')
    setProgress(undefined)
    setIsVisible(true)
  }

  const hide = () => {
    setIsVisible(false)
    setProgress(undefined)
  }

  const complete = (completeText?: string) => {
    setText(completeText || 'Pronto!')
    setProgress(100)
    setTimeout(() => {
      hide()
    }, 420)
  }

  return (
    <LoaderContext.Provider value={{ show, hide, complete, setText }}>
      {children}
      <Loader isVisible={isVisible} text={text} progress={progress} />
    </LoaderContext.Provider>
  )
}

export function useLoader() {
  const context = useContext(LoaderContext)
  if (!context) {
    throw new Error('useLoader must be used within a LoaderProvider')
  }
  return context
}
