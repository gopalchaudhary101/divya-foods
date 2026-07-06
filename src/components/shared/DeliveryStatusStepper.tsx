import React from 'react'
import { CheckCircle, Clock, Package, Truck, Star } from 'lucide-react'

const STEPS = [
  { key: 'pending',    label: 'Order Placed',  icon: Clock },
  { key: 'confirmed', label: 'Confirmed',      icon: CheckCircle },
  { key: 'processing',label: 'Processing',     icon: Package },
  { key: 'shipped',   label: 'Shipped',        icon: Truck },
  { key: 'delivered', label: 'Delivered',      icon: Star },
] as const

const STATUS_INDEX: Record<string, number> = {
  pending:    0,
  confirmed:  1,
  processing: 2,
  shipped:    3,
  delivered:  4,
  cancelled:  -1,
}

interface DeliveryStatusStepperProps {
  status: string
}

export function DeliveryStatusStepper({ status }: DeliveryStatusStepperProps) {
  const currentIdx = STATUS_INDEX[status] ?? 0
  const isCancelled = status === 'cancelled'

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <span className="text-red-500 text-sm font-semibold">Order Cancelled</span>
        <span className="text-xs text-red-400">— This order has been cancelled.</span>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start min-w-[340px]">
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          const done    = idx < currentIdx
          const active  = idx === currentIdx
          const pending = idx > currentIdx

          return (
            <React.Fragment key={step.key}>
              {/* Step node */}
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <div
                  className={[
                    'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 shrink-0',
                    done    ? 'bg-premium-teal text-white shadow-sm'           : '',
                    active  ? 'bg-premium-gold text-premium-navy shadow-md ring-4 ring-premium-gold/20' : '',
                    pending ? 'bg-premium-navy/10 dark:bg-ocean-800 text-premium-navy/30 dark:text-ocean-600' : '',
                  ].join(' ')}
                >
                  <Icon size={16} />
                </div>
                <span
                  className={[
                    'text-[10px] sm:text-xs font-medium text-center leading-tight px-0.5',
                    done    ? 'text-premium-teal' : '',
                    active  ? 'text-premium-navy dark:text-white font-semibold' : '',
                    pending ? 'text-premium-navy/30 dark:text-ocean-600' : '',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line between steps */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mt-4 mx-1 shrink-0 max-w-[40px] transition-colors duration-300"
                  style={{ background: idx < currentIdx ? '#2E8B8B' : '#CBD5E1' }}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
