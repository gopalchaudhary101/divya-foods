import React, { useMemo } from 'react'

interface OceanBackgroundProps {
  fish?: boolean
}

interface Bubble {
  id: number
  left: number
  size: number
  duration: number
  delay: number
}

const OceanBackground: React.FC<OceanBackgroundProps> = ({ fish = true }) => {
  const bubbles = useMemo<Bubble[]>(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 6 + Math.random() * 18,
        duration: 6 + Math.random() * 10,
        delay: Math.random() * 8,
      })),
    []
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-ocean-gradient" />

      {bubbles.map((b) => (
        <span
          key={b.id}
          className="bubble"
          style={{
            left: `${b.left}%`,
            bottom: '-40px',
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}

      {fish && (
        <>
          <svg
            className="absolute opacity-20 animate-float"
            style={{ left: '8%', top: '20%', width: 60 }}
            viewBox="0 0 100 60"
            aria-hidden="true"
          >
            <path d="M10 30 Q35 5 70 20 Q90 28 80 30 Q90 32 70 40 Q35 55 10 30 Z" fill="#B5D4F4" />
            <path d="M80 30 L96 18 L94 30 L96 42 Z" fill="#B5D4F4" />
          </svg>
          <svg
            className="absolute opacity-15 animate-float-delayed"
            style={{ right: '12%', top: '55%', width: 90 }}
            viewBox="0 0 100 60"
            aria-hidden="true"
          >
            <path d="M90 30 Q65 5 30 20 Q10 28 20 30 Q10 32 30 40 Q65 55 90 30 Z" fill="#FAC775" />
            <path d="M20 30 L4 18 L6 30 L4 42 Z" fill="#FAC775" />
          </svg>
        </>
      )}

      <div className="wave-divider absolute bottom-0 left-0 right-0 h-24 opacity-40">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="h-full">
          <path
            d="M0,60 C150,100 350,0 600,40 C850,80 1050,20 1200,60 L1200,120 L0,120 Z"
            fill="#0C447C"
          />
        </svg>
      </div>
    </div>
  )
}

export default OceanBackground
