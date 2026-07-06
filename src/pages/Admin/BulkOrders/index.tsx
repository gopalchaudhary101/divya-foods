import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Building2, Mail, Phone, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminBulkOrderApi, type BulkOrderRequest, type BulkOrderStatus } from '@/services/api/bulkOrderApi'
import { formatDate } from '@/utils/formatDate'
import { ROUTES } from '@/constants/routes'

const STATUS_OPTIONS: BulkOrderStatus[] = ['new', 'contacted', 'quoted', 'closed']

const STATUS_COLORS: Record<BulkOrderStatus, string> = {
  new:       'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  contacted: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  quoted:    'text-ocean-600 bg-ocean-50 dark:bg-ocean-900/30',
  closed:    'text-green-600 bg-green-50 dark:bg-green-900/20',
}

function DetailModal({ request, onClose }: { request: BulkOrderRequest; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(request.status)
  const [notes, setNotes] = useState(request.adminNotes ?? '')

  const mutation = useMutation({
    mutationFn: () => adminBulkOrderApi.update(request.id, { status, admin_notes: notes }),
    onSuccess: () => {
      toast.success('Request updated')
      queryClient.invalidateQueries({ queryKey: ['admin', 'bulk-orders'] })
      onClose()
    },
    onError: () => toast.error('Failed to update request'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ocean-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ocean-900 dark:text-white">
              {request.companyName || request.contactName}
            </h2>
            <p className="text-xs text-ocean-400">Submitted {formatDate(request.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-ocean-400 hover:text-ocean-700"><X size={18} /></button>
        </div>

        <div className="space-y-1 text-sm text-ocean-700 dark:text-ocean-200 mb-4">
          <p className="flex items-center gap-2"><Building2 size={13} className="text-ocean-400" /> {request.contactName}</p>
          <p className="flex items-center gap-2"><Mail size={13} className="text-ocean-400" /> {request.email}</p>
          <p className="flex items-center gap-2"><Phone size={13} className="text-ocean-400" /> {request.phone}</p>
        </div>

        <div className="bg-ocean-50 dark:bg-ocean-800 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-ocean-400 uppercase mb-2">Requested Items</p>
          <ul className="text-sm text-ocean-800 dark:text-ocean-100 space-y-1">
            {request.items.map((it, i) => (
              <li key={i}>{it.productName} — Qty {it.quantity}</li>
            ))}
          </ul>
        </div>

        {request.message && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-ocean-400 uppercase mb-1">Message</p>
            <p className="text-sm text-ocean-700 dark:text-ocean-200">{request.message}</p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as BulkOrderStatus)} className="input-field w-full">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Admin Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="input-field w-full resize-none"
            placeholder="Internal notes — quote sent, follow-up date, etc."
          />
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full py-2.5 bg-ocean-700 hover:bg-ocean-900 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default function AdminBulkOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<BulkOrderStatus | ''>('')
  const [selected, setSelected] = useState<BulkOrderRequest | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'bulk-orders', statusFilter],
    queryFn: () => adminBulkOrderApi.list(statusFilter || undefined),
  })

  const requests = data?.data ?? []

  return (
    <>
      <Helmet><title>Bulk Orders — Admin | Divya Foods</title></Helmet>
      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ADMIN.DASHBOARD} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-ocean-400" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
                <Building2 size={18} className="text-ocean-400" />
                Bulk / Wholesale Requests
              </h1>
              <p className="text-xs text-ocean-400">{data?.total ?? 0} total</p>
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as BulkOrderStatus | '')}
            className="input-field text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : requests.length === 0 ? (
              <div className="py-16 text-center text-ocean-400">
                <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No requests yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                      <th className="px-4 py-3">Company / Contact</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className="border-b border-ocean-50 dark:border-ocean-800/50 hover:bg-ocean-50 dark:hover:bg-ocean-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-ocean-900 dark:text-white">
                          {r.companyName || r.contactName}
                        </td>
                        <td className="px-4 py-3 text-sm text-ocean-500">{r.email}</td>
                        <td className="px-4 py-3 text-sm text-ocean-500">{r.items.length} item{r.items.length !== 1 ? 's' : ''}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[r.status]}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-ocean-400">{formatDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && <DetailModal request={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
