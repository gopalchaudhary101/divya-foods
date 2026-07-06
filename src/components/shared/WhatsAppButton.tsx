import { CONFIG } from '@/constants/config'

export function WhatsAppButton() {
  const phone = CONFIG.CONTACT.WHATSAPP ?? '919999123242'

  return (
    <a
      href={`https://wa.me/${phone}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-2 ring-premium-gold ring-offset-2 ring-offset-transparent transition-transform duration-300 hover:scale-110 focus-visible:outline-none focus-visible:ring-4"
    >
      <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" aria-hidden="true">
        <path d="M16.004 3C9.376 3 4 8.373 4 15c0 2.362.694 4.566 1.885 6.417L4 29l7.77-1.84A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.818a9.77 9.77 0 0 1-4.985-1.363l-.358-.213-4.611 1.092 1.114-4.494-.234-.372A9.77 9.77 0 0 1 5.273 15c0-5.911 4.82-10.727 10.73-10.727 5.912 0 10.73 4.816 10.73 10.727 0 5.911-4.818 10.818-10.73 10.818Zm5.885-8.09c-.322-.161-1.903-.938-2.198-1.045-.294-.107-.508-.161-.723.161-.214.322-.83 1.045-1.018 1.259-.187.214-.375.241-.696.08-.322-.16-1.36-.501-2.591-1.6-.958-.855-1.605-1.91-1.793-2.232-.187-.322-.02-.496.141-.656.144-.144.322-.375.482-.563.161-.187.214-.322.322-.536.107-.214.053-.402-.027-.563-.08-.161-.723-1.744-.99-2.389-.261-.626-.526-.54-.723-.55l-.616-.01c-.214 0-.563.08-.858.402-.294.322-1.123 1.098-1.123 2.677 0 1.579 1.15 3.104 1.31 3.318.161.214 2.264 3.457 5.487 4.848.766.331 1.364.529 1.83.677.769.245 1.469.21 2.023.128.617-.092 1.903-.778 2.171-1.529.268-.75.268-1.393.187-1.528-.08-.134-.294-.214-.616-.375Z" />
      </svg>
    </a>
  )
}
