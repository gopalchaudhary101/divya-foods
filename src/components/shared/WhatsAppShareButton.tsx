import type { MouseEvent } from 'react'
import { MessageCircle } from 'lucide-react'
import { useWhatsAppConfig, buildWhatsAppUrl } from '@/hooks/useWhatsApp'
import { whatsappApi } from '@/services/api/whatsappApi'

export type WhatsAppShareSource = 'product_card' | 'product_detail' | 'cart' | 'order'

interface TrackItem {
  productId: string
  productName: string
}

interface WhatsAppShareButtonProps {
  /** Fully-built message text (caller has already filled the template placeholders). */
  message: string
  source: WhatsAppShareSource
  /** Product(s) this share represents, for the admin "most shared products" analytics. */
  trackItems?: TrackItem[]
  /** Icon-only round button (product grids) instead of a full labeled button. */
  compact?: boolean
  label?: string
  className?: string
}

// Reused on product cards (grids of dozens), the product detail page, the
// cart summary, and order confirmation — a single component so the message-
// building + share-tracking + disabled-when-admin-turns-it-off logic only
// lives in one place.
export function WhatsAppShareButton({
  message,
  source,
  trackItems = [],
  compact = false,
  label = 'Share on WhatsApp',
  className = '',
}: WhatsAppShareButtonProps) {
  const { data: config } = useWhatsAppConfig()

  // Hidden entirely when the admin has disabled sharing or hasn't set a
  // number yet — never show a button that can't actually go anywhere.
  if (!config?.enabled || !config.phoneNumber) return null

  function handleClick(e: MouseEvent) {
    // Buttons are sometimes nested inside a card's outer <Link> (product
    // grids) — stop it from also triggering navigation.
    e.preventDefault()
    e.stopPropagation()
    // Fire-and-forget — a tracking failure should never block the share itself.
    for (const item of trackItems) {
      whatsappApi.trackShare({ productId: item.productId, productName: item.productName, source }).catch(() => {})
    }
    window.open(buildWhatsAppUrl(config!.phoneNumber, message), '_blank', 'noopener,noreferrer')
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-sm transition-colors ${className}`}
      >
        <MessageCircle size={16} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-sm transition-colors ${className}`}
    >
      <MessageCircle size={16} />
      {label}
    </button>
  )
}
