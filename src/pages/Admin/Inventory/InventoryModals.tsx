import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History } from 'lucide-react'
import toast from 'react-hot-toast'
import axiosInstance from '@/services/api/axiosInstance'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/utils/formatDate'
import type { ApiResponse } from '@/types'
import type { InventoryProduct, StockMovement } from './types'

// ─── Shared modal shell ─────────────────────────────────────────────────────

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
    <Modal isOpen onClose={onClose} title={title} size="md" tone="admin">
      <div className="px-6 py-5">{children}</div>
    </Modal>
  )
}

// ─── Adjust stock ───────────────────────────────────────────────────────────

export function AdjustStockModal({ product, onClose }: { product: InventoryProduct; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<'add' | 'remove' | 'damaged'>('add')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.post(`/admin/products/${product.id}/stock-adjustment`, {
        type, quantity: parseInt(quantity, 10), note: note || undefined,
      })
    },
    onSuccess: () => {
      toast.success('Stock updated')
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to update stock')
    },
  })

  return (
    <ModalShell title={`Adjust Stock — ${product.name}`} onClose={onClose}>
      <p className="text-sm text-ocean-500 dark:text-ocean-400 mb-4">
        Current stock: <strong className="text-ocean-900 dark:text-white">{product.stockQuantity}</strong>
      </p>

      <div className="flex gap-2 mb-4">
        {(['add', 'remove', 'damaged'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize border transition-colors ${
              type === t
                ? 'bg-ocean-700 text-white border-ocean-700'
                : 'border-ocean-200 dark:border-ocean-700 text-ocean-600 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-ocean-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="form-label">Quantity</label>
      <input
        type="number" min="1" value={quantity}
        onChange={e => setQuantity(e.target.value)}
        className="input-field w-full mb-4"
      />

      <label className="form-label">Note (optional)</label>
      <textarea
        value={note} onChange={e => setNote(e.target.value)} rows={2}
        className="input-field w-full resize-none mb-5"
      />

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary" className="flex-1"
          loading={mutation.isPending}
          disabled={!quantity || parseInt(quantity, 10) <= 0}
          onClick={() => mutation.mutate()}
        >
          Save
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Record return ──────────────────────────────────────────────────────────

export function RecordReturnModal({ product, onClose }: { product: InventoryProduct; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState('')
  const [restock, setRestock] = useState(true)
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.post(`/admin/products/${product.id}/returns`, {
        quantity: parseInt(quantity, 10), restock, note: note || undefined,
      })
    },
    onSuccess: () => {
      toast.success('Return recorded')
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to record return')
    },
  })

  return (
    <ModalShell title={`Record Return — ${product.name}`} onClose={onClose}>
      <label className="form-label">Quantity Returned</label>
      <input
        type="number" min="1" value={quantity}
        onChange={e => setQuantity(e.target.value)}
        className="input-field w-full mb-4"
      />

      <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
        <input type="checkbox" checked={restock} onChange={e => setRestock(e.target.checked)} />
        <span className="text-sm text-ocean-700 dark:text-ocean-200">
          Item is sellable — add back to stock
        </span>
      </label>

      <label className="form-label">Note (optional)</label>
      <textarea
        value={note} onChange={e => setNote(e.target.value)} rows={2}
        className="input-field w-full resize-none mb-5"
        placeholder="e.g. Customer reported damaged packaging"
      />

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary" className="flex-1"
          loading={mutation.isPending}
          disabled={!quantity || parseInt(quantity, 10) <= 0}
          onClick={() => mutation.mutate()}
        >
          Save
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Stock history ──────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<string, string> = {
  product_created: 'Product Created', manual_adjustment: 'Manual Adjustment',
  order_placed: 'Order Placed', order_cancelled: 'Order Cancelled',
  stock_added: 'Stock Added', stock_removed: 'Stock Removed', damaged: 'Marked Damaged',
  return_received: 'Return Received', purchase_received: 'Purchase Received',
}

export function StockHistoryModal({ product, onClose }: { product: InventoryProduct; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'inventory', 'history', product.id],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<{ data: StockMovement[] }>>(
        `/admin/products/${product.id}/stock-history`,
      )
      return data.data.data
    },
  })

  return (
    <ModalShell title={`Stock History — ${product.name}`} onClose={onClose}>
      {isLoading ? (
        <div className="py-8 text-center">
          <div className="w-6 h-6 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="py-8 text-center text-sm text-ocean-400">
          <History size={28} className="mx-auto mb-2 opacity-40" />
          No stock movements yet.
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {data.map(m => (
            <div key={m.id} className="flex items-start justify-between gap-3 pb-3 border-b border-ocean-50 dark:border-ocean-800 last:border-0">
              <div>
                <p className="text-sm font-medium text-ocean-900 dark:text-white">
                  {MOVEMENT_LABELS[m.type] ?? m.type}
                </p>
                {m.note && <p className="text-xs text-ocean-500 mt-0.5">{m.note}</p>}
                <p className="text-xs text-ocean-300 mt-0.5">{formatDate(m.createdAt)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${m.quantityDelta > 0 ? 'text-mint-600' : m.quantityDelta < 0 ? 'text-red-500' : 'text-ocean-400'}`}>
                  {m.quantityDelta > 0 ? '+' : ''}{m.quantityDelta}
                </p>
                <p className="text-xs text-ocean-400">→ {m.resultingStock}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  )
}
