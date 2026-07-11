import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/**
 * A small koi that trails the mouse cursor site-wide — a playful, on-theme
 * touch for a seafood storefront. Follows with a spring lag (like a pet,
 * not glued to the pointer) and banks its rotation toward the direction of
 * travel. Only enabled on pointer-fine devices (real mice) — there's no
 * cursor to follow on touch screens, so it never renders there.
 */
export function FishCursor() {
  const [enabled, setEnabled] = useState(false)

  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)
  const x = useSpring(mouseX, { damping: 20, stiffness: 150, mass: 0.6 })
  const y = useSpring(mouseY, { damping: 20, stiffness: 150, mass: 0.6 })

  const rotate = useMotionValue(0)
  const rotateSpring = useSpring(rotate, { damping: 18, stiffness: 120 })

  const lastPos = useRef({ x: -100, y: -100 })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const isFinePointer = window.matchMedia('(pointer: fine)').matches
    setEnabled(isFinePointer)
    if (!isFinePointer) return

    function handleMove(e: MouseEvent) {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        rotate.set(Math.atan2(dy, dx) * (180 / Math.PI))
      }
      lastPos.current = { x: e.clientX, y: e.clientY }
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }

    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [mouseX, mouseY, rotate])

  if (!enabled) return null

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-40"
      style={{ x, y, translateX: '-50%', translateY: '-50%', rotate: rotateSpring }}
    >
      <motion.svg
        width="36"
        height="20"
        viewBox="0 0 44 24"
        fill="none"
        animate={{ rotate: [0, -6, 0, 6, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* tail */}
        <path d="M12 12 L2 3 L2 21 Z" fill="#0C447C" />
        {/* body */}
        <ellipse cx="26" cy="12" rx="14" ry="9" fill="#D4AF37" />
        {/* top fin */}
        <path d="M22 3 L28 3 L24 -3 Z" fill="#0C447C" opacity="0.85" />
        {/* eye */}
        <circle cx="35" cy="9" r="2" fill="#042C53" />
      </motion.svg>
    </motion.div>
  )
}
