import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import axiosInstance from '@/services/api/axiosInstance'
import { Button } from '@/components/ui/Button'
import type { Purchase } from './types'

interface ProductOption {
  id: string
  name: string
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ocean-100 dark:border-ocean-800 sticky top-0 bg-white dark:bg-ocean-900">
          <h3 className="font-display font-semibold text-ocean-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg">
            <X size={18} className="text-ocean-400" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Create / edit purchase order ───────────────────────────────────────────

export function PurchaseFormModal({
  products,
  purchase,
  onClose,
}: {
  products: ProductOption[]
  purchase: Purchase | null
  onClose: () => void
}) {
  const isEdit = !!purchase
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    productId:     purchase?.productId ?? '',
    supplierName:  purchase?.supplierName ?? '',
    purchaseDate:  purchase?.purchaseDate ? purchase.purchaseDate.slice(0, 10) : '',
    unitCost:      purchase ? String(purchase.unitCost) : '',
    quantity:      purchase ? String(purchase.quantity) : '',
    invoiceNumber: purchase?.invoiceNumber ?? '',
    batchNumber:   purchase?.batchNumber ?? '',
    expiryDate:    purchase?.expiryDate ? purchase.expiryDate.slice(0, 10) : '',
    notes:         purchase?.notes ?? '',
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        productId:     form.productId,
        supplierName:  form.supplierName.trim(),
        purchaseDate:  form.purchaseDate ? new Date(form.purchaseDate).toISOString() : undefined,
        unitCost:      parseFloat(form.unitCost) || 0,
        quantity:      parseInt(form.quantity, 10) || 0,
        invoiceNumber: form.invoiceNumber.trim() || undefined,
        batchNumber:   form.batchNumber.trim() || undefined,
        expiryDate:    form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
        notes:         form.notes.trim() || undefined,
      }
      if (isEdit) {
        await axiosInstance.put(`/admin/purchases/${purchase!.id}`, payload)
      } else {
        await axiosInstance.post('/admin/purchases', payload)
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Purchase order updated' : 'Purchase order created')
      queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to save purchase order')
    },
  })

  const valid = form.productId && form.supplierName.trim() && parseFloat(form.unitCost) >= 0 && parseInt(form.quantity, 10) > 0

  return (
    <ModalShell title={isEdit ? 'Edit Purchase Order' : 'New Purchase Order'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="form-label">Product *</label>
          <select
            value={form.productId}
            onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
            disabled={isEdit}
            className="input-field w-full"
          >
            <option value="">Select a product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Supplier *</label>
          <input
            value={form.supplierName}
            onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))}
            className="input-field w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Purchase Date</label>
            <input
              type="date" value={form.purchaseDate}
              onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="form-label">Expiry Date</label>
            <input
              type="date" value={form.expiryDate}
              onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
              className="input-field w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Unit Cost (₹) *</label>
            <input
              type="number" min="0" step="0.01" value={form.unitCost}
              onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="form-label">Quantity *</label>
            <input
              type="number" min="1" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              className="input-field w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Invoice Number</label>
            <input
              value={form.invoiceNumber}
              onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="form-label">Batch Number</label>
            <input
              value={form.batchNumber}
              onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))}
              className="input-field w-full"
            />
          </div>
        </div>

        <div>
          <label className="form-label">Notes</label>
          <textarea
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2} className="input-field w-full resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary" className="flex-1"
            loading={mutation.isPending}
            disabled={!valid}
            onClick={() => mutation.mutate()}
          >
            {isEdit ? 'Save Changes' : 'Create Purchase Order'}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
