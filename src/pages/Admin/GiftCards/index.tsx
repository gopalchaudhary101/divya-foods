import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Gift, Plus, X, Copy, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminGiftCardApi, type GiftCardIssuePayload } from '@/services/api/giftCardApi'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { ROUTES } from '@/constants/routes'

function IssueModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState('500')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const payload: GiftCardIssuePayload = { value: Number(value) }
      if (code.trim()) payload.code = code.trim().toUpperCase()
      if (email.trim()) payload.issued_to_email = email.trim()
      if (notes.trim()) payload.notes = notes.trim()
      return adminGiftCardApi.issue(payload)
    },
    onSuccess: (card) => {
      toast.success(`Gift card ${card.code} issued`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'gift-cards'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to issue gift card')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-ocean-900 rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-ocean-900 dark:text-white">Issue Gift Card</h2>
          <button onClick={onClose} className="text-ocean-400 hover:text-ocean-700"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Value (₹) *</label>
            <input type="number" min={1} value={value} onChange={e => setValue(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Custom Code</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Auto-generated if left blank" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Issued To (email)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input-field w-full resize-none" placeholder="Internal note (optional)" />
          </div>
        </div>

        <Button
          variant="primary" size="lg" className="w-full mt-5"
          loading={mutation.isPending}
          disabled={!value || Number(value) <= 0}
          onClick={() => mutation.mutate()}
        >
          Issue Gift Card
        </Button>
      </div>
    </div>
  )
}

export default function AdminGiftCardsPage() {
  const [showIssue, setShowIssue] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'gift-cards'],
    queryFn: () => adminGiftCardApi.list(),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminGiftCardApi.update(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'gift-cards'] }),
    onError: () => toast.error('Failed to update gift card'),
  })

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast.success('Code copied')
  }

  const cards = data?.data ?? []

  return (
    <>
      <Helmet><title>Gift Cards — Admin | Divya Foods</title></Helmet>
      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ADMIN.DASHBOARD} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-ocean-400" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
                <Gift size={18} className="text-ocean-400" />
                Gift Cards
              </h1>
              <p className="text-xs text-ocean-400">{data?.total ?? 0} total</p>
            </div>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowIssue(true)}>
            Issue Gift Card
          </Button>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : cards.length === 0 ? (
              <div className="py-16 text-center text-ocean-400">
                <Gift size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No gift cards yet</p>
                <Button variant="outline" size="sm" className="mt-4" leftIcon={<Plus size={13} />} onClick={() => setShowIssue(true)}>
                  Issue Gift Card
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Issued To</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map(card => (
                      <tr key={card.id} className="border-b border-ocean-50 dark:border-ocean-800/50">
                        <td className="px-4 py-3 text-sm font-mono font-medium text-ocean-900 dark:text-white">
                          <button onClick={() => copyCode(card.code)} className="flex items-center gap-1.5 hover:text-ocean-600" title="Copy code">
                            {card.code} <Copy size={11} className="text-ocean-300" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-ocean-500">{formatCurrency(card.initialValue)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-ocean-900 dark:text-white">{formatCurrency(card.balance)}</td>
                        <td className="px-4 py-3 text-sm text-ocean-500">{card.issuedToEmail || '—'}</td>
                        <td className="px-4 py-3 text-sm text-ocean-400">{formatDate(card.createdAt)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleMutation.mutate({ id: card.id, isActive: !card.isActive })}
                            className={card.isActive ? 'text-mint-500' : 'text-ocean-300'}
                            title={card.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                          >
                            {card.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showIssue && <IssueModal onClose={() => setShowIssue(false)} />}
    </>
  )
}
