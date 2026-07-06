import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, Trash2, Building2, CheckCircle } from 'lucide-react'
import { bulkOrderApi, type BulkOrderItemInput } from '@/services/api/bulkOrderApi'
import { Button } from '@/components/ui/Button'

interface FormState {
  companyName: string
  contactName: string
  email: string
  phone: string
  message: string
}

const EMPTY_ITEM: BulkOrderItemInput = { productName: '', quantity: 1 }

export default function BulkOrderPage() {
  const [form, setForm] = useState<FormState>({ companyName: '', contactName: '', email: '', phone: '', message: '' })
  const [items, setItems] = useState<BulkOrderItemInput[]>([{ ...EMPTY_ITEM }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function updateItem(idx: number, patch: Partial<BulkOrderItemInput>) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanItems = items
      .map(it => ({ productName: it.productName.trim(), quantity: Number(it.quantity) }))
      .filter(it => it.productName && it.quantity > 0)

    if (cleanItems.length === 0) {
      setError('Add at least one product with a quantity.')
      return
    }

    setSubmitting(true)
    try {
      await bulkOrderApi.submit({
        company_name: form.companyName.trim() || undefined,
        contact_name: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        items: cleanItems,
        message: form.message.trim() || undefined,
      })
      setSubmitted(true)
    } catch {
      setError('Could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <>
        <Helmet><title>Bulk Order Request — Divya Luxury Seafoods</title></Helmet>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <CheckCircle size={56} className="mx-auto text-premium-teal mb-5" />
          <h1 className="font-display text-2xl font-semibold text-premium-navy dark:text-white mb-2">Request Received!</h1>
          <p className="text-premium-navy/60">
            Thank you for your interest in wholesale ordering. Our team will reach out to you at{' '}
            <strong className="text-premium-navy dark:text-ocean-100">{form.email}</strong> with a custom quote shortly.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet><title>Bulk / Wholesale Orders — Divya Luxury Seafoods</title></Helmet>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-8">
          <Building2 size={40} className="mx-auto text-premium-teal mb-3" />
          <h1 className="font-display text-2xl font-semibold text-premium-navy dark:text-white mb-2">
            Bulk & Wholesale Orders
          </h1>
          <p className="text-sm text-premium-navy/40">
            Restaurants, hotels, and retailers — tell us what you need and we'll send a custom quote.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Company / Business Name</label>
              <input
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                className="df-input w-full" placeholder="Ocean Bistro (optional)"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Contact Name *</label>
              <input
                required
                value={form.contactName}
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                className="df-input w-full" placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Email *</label>
              <input
                type="email" required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="df-input w-full" placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Phone *</label>
              <input
                required
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="df-input w-full" placeholder="+91 9999123456"
              />
            </div>
          </div>

          <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-2">Products & Quantities *</label>
          <div className="flex flex-col gap-2 mb-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={item.productName}
                  onChange={e => updateItem(idx, { productName: e.target.value })}
                  className="df-input flex-1" placeholder="e.g. Frozen Salmon Fillet"
                />
                <input
                  type="number" min={1}
                  value={item.quantity}
                  onChange={e => updateItem(idx, { quantity: Number(e.target.value) })}
                  className="df-input w-24" placeholder="Qty"
                />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="px-3 text-premium-navy/30 hover:text-red-500 disabled:opacity-30 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 text-sm text-premium-teal hover:text-premium-gold font-medium mb-5"
          >
            <Plus size={14} /> Add another product
          </button>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Message</label>
            <textarea
              rows={3}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="df-input w-full resize-none" placeholder="Delivery frequency, budget, or any other details (optional)"
            />
          </div>

          <Button type="submit" variant="premium" size="lg" className="w-full" loading={submitting}>
            Submit Request
          </Button>
        </form>
      </div>
    </>
  )
}
