import React, { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  value: string // e.g. "500+", "24h", "100%" — leading integer is animated, rest is kept as suffix
  durationMs?: number
}

/** Counts up from 0 to the leading number in `value` once it scrolls into view. */
export function AnimatedCounter({ value, durationMs = 1400 }: AnimatedCounterProps) {
  const match = value.match(/^(\d+)(.*)$/)
  const target = match ? parseInt(match[1], 10) : null
  const suffix = match ? match[2] : ''

  const [display, setDisplay] = useState(0)
  const spanRef = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (target === null) return
    const el = spanRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const start = performance.now()
          const step = (now: number) => {
            const progress = Math.min((now - start) / durationMs, 1)
            setDisplay(Math.round(progress * target))
            if (progress < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, durationMs])

  if (target === null) return <span ref={spanRef}>{value}</span>

  return (
    <span ref={spanRef}>
      {display}
      {suffix}
    </span>
  )
}
