import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, RefreshCw, Copy, Facebook, Linkedin, MessageCircle, Instagram, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'
import axiosInstance from '@/services/api/axiosInstance'
import { Button } from '@/components/ui/Button'
import type { ApiResponse } from '@/types'

interface MarketingContent {
  seoTitle: string
  seoDescription: string
  caption: string
  hashtags: string[]
  productUrl: string
}

// X's web-intent, Facebook's sharer, LinkedIn's sharing endpoint, and wa.me all accept
// prefilled content via query params with no API/credentials needed. Instagram and
// YouTube have no equivalent public "share this link" web intent, so instead of a
// fake button that silently does nothing, Instagram gets a copy-to-clipboard + open
// workaround and YouTube/Google Business aren't included here at all.
function buildShareLinks(content: MarketingContent) {
  const text = `${content.caption} ${content.hashtags.join(' ')}`
  const url = content.productUrl
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(content.caption)}&url=${encodeURIComponent(url)}&hashtags=${content.hashtags.map(h => h.replace('#', '')).join(',')}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  }
}

export function MarketingModal({
  productId,
  productName,
  onClose,
}: {
  productId: string
  productName: string
  onClose: () => void
}) {
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [downloadingQr, setDownloadingQr] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await axiosInstance.post<ApiResponse<MarketingContent>>(`/admin/products/${productId}/marketing`)
      return data.data
    },
    onSuccess: (data) => {
      setSeoTitle(data.seoTitle)
      setSeoDescription(data.seoDescription)
      setCaption(data.caption)
      setHashtags(data.hashtags.join(' '))
      setProductUrl(data.productUrl)
      setLoaded(true)
    },
    onError: () => toast.error('Failed to generate marketing content'),
  })

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  }

  async function downloadQrCode() {
    setDownloadingQr(true)
    try {
      const { data } = await axiosInstance.get(`/admin/products/${productId}/qr-code`, { responseType: 'blob' })
      const url = URL.createObjectURL(data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qr-${productId}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to generate QR code')
    } finally {
      setDownloadingQr(false)
    }
  }

  function shareToInstagram() {
    navigator.clipboard.writeText(`${caption} ${hashtags}`)
    toast.success('Caption copied — paste it when you create your Instagram post')
    window.open('https://www.instagram.com', '_blank')
  }

  const links = loaded
    ? buildShareLinks({ seoTitle, seoDescription, caption, hashtags: hashtags.split(' ').filter(Boolean), productUrl })
    : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ocean-100 dark:border-ocean-800 sticky top-0 bg-white dark:bg-ocean-900">
          <h3 className="font-display font-semibold text-ocean-900 dark:text-white">Marketing — {productName}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg">
            <X size={18} className="text-ocean-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <button
            onClick={downloadQrCode}
            disabled={downloadingQr}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-ocean-200 dark:border-ocean-700 rounded-xl text-ocean-600 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors disabled:opacity-50"
          >
            <QrCode size={13} /> {downloadingQr ? 'Generating…' : 'Download QR Code'}
          </button>

          {!loaded ? (
            <div className="py-10 text-center">
              <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
                Generate Marketing Content
              </Button>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label">SEO Title</label>
                  <button onClick={() => copy(seoTitle, 'SEO title')} className="text-ocean-400 hover:text-ocean-700" title="Copy">
                    <Copy size={13} />
                  </button>
                </div>
                <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} className="input-field w-full text-sm" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label">SEO Description</label>
                  <button onClick={() => copy(seoDescription, 'SEO description')} className="text-ocean-400 hover:text-ocean-700" title="Copy">
                    <Copy size={13} />
                  </button>
                </div>
                <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} rows={2} className="input-field w-full text-sm resize-none" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label">Social Caption</label>
                  <button onClick={() => copy(caption, 'Caption')} className="text-ocean-400 hover:text-ocean-700" title="Copy">
                    <Copy size={13} />
                  </button>
                </div>
                <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3} className="input-field w-full text-sm resize-none" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label">Hashtags</label>
                  <button onClick={() => copy(hashtags, 'Hashtags')} className="text-ocean-400 hover:text-ocean-700" title="Copy">
                    <Copy size={13} />
                  </button>
                </div>
                <input value={hashtags} onChange={e => setHashtags(e.target.value)} className="input-field w-full text-sm font-mono" />
              </div>

              <div className="pt-2 border-t border-ocean-100 dark:border-ocean-800">
                <p className="form-label mb-2">Share</p>
                <div className="flex flex-wrap gap-2">
                  <a href={links!.facebook} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-ocean-200 dark:border-ocean-700 rounded-xl text-ocean-600 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
                    <Facebook size={13} /> Facebook
                  </a>
                  <a href={links!.x} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-ocean-200 dark:border-ocean-700 rounded-xl text-ocean-600 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
                    X
                  </a>
                  <a href={links!.whatsapp} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-ocean-200 dark:border-ocean-700 rounded-xl text-ocean-600 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                  <a href={links!.linkedin} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-ocean-200 dark:border-ocean-700 rounded-xl text-ocean-600 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
                    <Linkedin size={13} /> LinkedIn
                  </a>
                  <button onClick={shareToInstagram}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-ocean-200 dark:border-ocean-700 rounded-xl text-ocean-600 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
                    <Instagram size={13} /> Instagram
                  </button>
                </div>
                <p className="text-xs text-ocean-400 mt-2">
                  Instagram has no direct share link — the caption is copied to your clipboard and Instagram opens in a new tab.
                </p>
              </div>

              <Button variant="outline" size="sm" leftIcon={<RefreshCw size={13} />} loading={mutation.isPending} onClick={() => mutation.mutate()}>
                Regenerate
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
