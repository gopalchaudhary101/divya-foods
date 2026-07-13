import { useQuery } from '@tanstack/react-query'
import { whatsappApi } from '@/services/api/whatsappApi'
import { queryKeys } from '@/services/queryKeys'

/**
 * Click-to-chat config (enabled flag, business phone number, message
 * templates). Long staleTime — this only changes when an admin edits it in
 * the WhatsApp settings page, and every share button on the site reads it.
 */
export function useWhatsAppConfig() {
  return useQuery({
    queryKey: queryKeys.whatsapp.config(),
    queryFn: whatsappApi.getConfig,
    staleTime: 1000 * 60 * 30,
  })
}

/** Fills `{placeholder}` tokens in a message template with real values. */
export function fillWhatsAppTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}

/** Builds the click-to-chat deep link. `phoneNumber` is digits only (E.164, no leading +). */
export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
}
