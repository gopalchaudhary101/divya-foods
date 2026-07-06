import React, { useState } from 'react'
import { MapPin, CheckCircle, XCircle, Clock } from 'lucide-react'

interface DeliveryResult {
  available: boolean
  area: string
  eta: string
}

function checkDelivery(pin: string): DeliveryResult | null {
  if (!/^\d{6}$/.test(pin)) return null
  const n = parseInt(pin, 10)

  if (n >= 110001 && n <= 110099)
    return { available: true, area: 'Delhi', eta: 'Same-day delivery if ordered before 2 PM' }

  if (n >= 122001 && n <= 122108)
    return { available: true, area: 'Gurgaon / Gurugram', eta: 'Delivery within 24 hours' }

  if (n >= 201301 && n <= 201314)
    return { available: true, area: 'Noida', eta: 'Delivery within 24 hours' }

  if ((n >= 201315 && n <= 201320) || n === 201306 || n === 201310 || n === 201318)
    return { available: true, area: 'Greater Noida', eta: 'Delivery within 24 hours' }

  if (n >= 121001 && n <= 121012)
    return { available: true, area: 'Faridabad', eta: 'Delivery within 24 hours' }

  return { available: false, area: '', eta: '' }
}

interface PincodeCheckerProps {
  /** compact mode — smaller padding, used inline on product pages */
  compact?: boolean
}

export function PincodeChecker({ compact = false }: PincodeCheckerProps) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<DeliveryResult | null>(null)

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setResult(checkDelivery(input.trim()))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setInput(val)
    if (val.length < 6) setResult(null)
    // Auto-check when 6 digits entered
    if (val.length === 6) setResult(checkDelivery(val))
  }

  return (
    <div className={compact ? '' : 'bg-premium-navy/5 dark:bg-ocean-900/40 rounded-2xl p-4 border border-premium-navy/10 dark:border-ocean-800'}>
      {!compact && (
        <p className="df-eyebrow mb-3 flex items-center gap-1.5">
          <MapPin size={12} /> Check Delivery Availability
        </p>
      )}

      <form onSubmit={handleCheck} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={input}
          onChange={handleChange}
          placeholder="Enter pincode"
          maxLength={6}
          className={[
            'flex-1 border border-premium-navy/15 dark:border-ocean-700 rounded-xl px-3 text-sm',
            'dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-premium-gold',
            compact ? 'py-2' : 'py-2.5',
          ].join(' ')}
        />
        <button
          type="submit"
          disabled={input.length !== 6}
          className={[
            'px-4 rounded-xl text-sm font-semibold transition-colors',
            'bg-premium-gold text-premium-navy hover:bg-premium-gold-light disabled:opacity-40 disabled:cursor-not-allowed',
            compact ? 'py-2' : 'py-2.5',
          ].join(' ')}
        >
          Check
        </button>
      </form>

      {result !== null && (
        <div className={`mt-3 flex items-start gap-2 text-sm ${compact ? '' : ''}`}>
          {result.available ? (
            <>
              <CheckCircle size={15} className="text-premium-teal shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-premium-teal">
                  Delivery available in {result.area}
                </span>
                <p className="text-xs text-premium-navy/50 dark:text-ocean-400 mt-0.5 flex items-center gap-1">
                  <Clock size={11} /> {result.eta}
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  Not serviceable yet
                </span>
                <p className="text-xs text-premium-navy/50 dark:text-ocean-400 mt-0.5">
                  We currently deliver to Delhi, Gurgaon, Noida & Greater Noida.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
