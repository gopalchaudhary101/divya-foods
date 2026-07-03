import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  endsAt: string
  onExpire?: () => void
}

function getTimeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return null
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  return { h, m, s }
}

export default function CountdownTimer({ endsAt, onExpire }: Props) {
  const [left, setLeft] = useState(() => getTimeLeft(endsAt))

  useEffect(() => {
    const id = setInterval(() => {
      const t = getTimeLeft(endsAt)
      setLeft(t)
      if (!t) {
        clearInterval(id)
        onExpire?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt, onExpire])

  if (!left) {
    return <span className="text-xs text-red-500 font-semibold">Expired</span>
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-red-600 dark:text-red-400">
      <Clock size={12} />
      {pad(left.h)}:{pad(left.m)}:{pad(left.s)}
    </span>
  )
}
