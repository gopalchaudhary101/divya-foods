import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Search, X, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminReturnApi, type ReturnRequestRecord, type ReturnStatus } from '@/services/api/returnApi'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { ROUTES } from '@/constants/routes'

const STATUS_OPTIONS: ReturnStatus[] = ['requested', 'approved', 'rejected', 'refunded']

const STATUS_COLORS: Record<ReturnStatus, string> = {
  requested: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  approved:  'text-ocean-600 bg-ocean-50 dark:bg-ocean-900/30',
  rejected:  'text-red-500 bg-red-50 dark:bg-red-900/20',
  refunded:  'text-green-600 bg-green-50 dark:bg-green-900/20',
}

const REASON_LABELS: Record<string, string> = {
  wrong_item: 'Wrong item delivered',
  damaged_or_spoiled: 'Damaged or spoiled on arrival',
  missing_item: 'Item missing from delivery',
  other: 'Other',
}

function DetailModal({ ret, onClose }: { ret: ReturnRequestRecord; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualReference, setManualReference] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] })

  const approveMutation = useMutation({
    mutationFn: () => adminReturnApi.approve(ret.id, note),
    onSuccess: () => {
      toast.success('Return approved — refund initiated')
      invalidate()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to approve return')
    },
  })

  const approveManualMutation = useMutation({
    mutationFn: () => adminReturnApi.approveManual(ret.id, manualReference, note),
    onSuccess: () => {
      toast.success('Manual refund recorded')
      invalidate()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to record manual refund')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => adminReturnApi.reject(ret.id, note),
    onSuccess: () => {
      toast.success('Return rejected')
      invalidate()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to reject return')
    },
  })

  const resolved = ret.status !== 'requested'
  const isRazorpayOrder = ret.orderPaymentMethod === 'razorpay'

  return (
    <Modal isOpen onClose={onClose} size="lg" tone="admin">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ocean-900 dark:text-white">{ret.orderNumber}</h2>
            <p className="text-xs text-ocean-400">Requested {formatDate(ret.requestedAt)}</p>
          </div>
          <button onClick={onClose} className="text-ocean-400 hover:text-ocean-700"><X size={18} /></button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[ret.status]}`}>
            {ret.status}
          </span>
          <span className="text-xs text-ocean-400">
            Paid via <span className="font-medium uppercase">{ret.orderPaymentMethod ?? 'unknown'}</span>
          </span>
        </div>

        <div className="bg-ocean-50 dark:bg-ocean-800 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-ocean-400 uppercase mb-2">Items</p>
          <ul className="text-sm text-ocean-800 dark:text-ocean-100 space-y-1">
            {ret.items.map((it, i) => (
              <li key={i}>{it.quantity}× {it.name} — {formatCurrency(it.price * it.quantity)}</li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-ocean-700 dark:text-ocean-200 mb-1">
          <strong>Reason:</strong> {REASON_LABELS[ret.reason] ?? ret.reason}
        </p>
        {ret.note && (
          <p className="text-sm text-ocean-700 dark:text-ocean-200 mb-4"><strong>Customer note:</strong> {ret.note}</p>
        )}
        <p className="text-sm font-semibold text-ocean-900 dark:text-white mb-4">
          Refund amount: {formatCurrency(ret.refundAmount)}
        </p>

        {ret.adminNote && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-ocean-400 uppercase mb-1">Admin Note</p>
            <p className="text-sm text-ocean-700 dark:text-ocean-200">{ret.adminNote}</p>
          </div>
        )}

        {resolved && ret.refundMethod && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-ocean-400 uppercase mb-1">Refund Method</p>
            <p className="text-sm text-ocean-700 dark:text-ocean-200 capitalize">
              {ret.refundMethod}{ret.refundReference && ` — ${ret.refundReference}`}
            </p>
          </div>
        )}

        {!resolved && (
          <>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                Note (required to reject, optional to approve)
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                className="input-field w-full resize-none"
                placeholder="Explain your decision — sent to the customer if rejected"
              />
            </div>

            {showManualForm && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                  Refund Reference
                </label>
                <input
                  value={manualReference}
                  onChange={e => setManualReference(e.target.value)}
                  placeholder="Bank transfer UTR, receipt number, etc."
                  className="input-field w-full"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                size="sm"
                loading={rejectMutation.isPending}
                disabled={!note.trim()}
                onClick={() => rejectMutation.mutate()}
              >
                Reject
              </Button>

              {isRazorpayOrder && !showManualForm && (
                <Button
                  variant="premium"
                  size="sm"
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate()}
                >
                  Approve &amp; Refund via Razorpay
                </Button>
              )}

              {!showManualForm ? (
                <Button variant="premiumOutline" size="sm" onClick={() => setShowManualForm(true)}>
                  Record Manual Refund
                </Button>
              ) : (
                <Button
                  variant="premium"
                  size="sm"
                  loading={approveManualMutation.isPending}
                  disabled={!manualReference.trim()}
                  onClick={() => approveManualMutation.mutate()}
                >
                  Confirm Manual Refund
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default function AdminReturnsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | ''>('')
  const [selected, setSelected] = useState<ReturnRequestRecord | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'returns', page, search, statusFilter],
    queryFn: () => adminReturnApi.list(statusFilter || undefined, search || undefined, page),
  })

  const returns = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <>
      <Helmet><title>Returns — Admin | Divya Foods</title></Helmet>
      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ADMIN.DASHBOARD} className="flex items-center gap-1.5 text-xs text-ocean-400 hover:text-ocean-700 transition-colors">
              <LayoutDashboard size={13} /> Dashboard
            </Link>
            <span className="text-ocean-200">/</span>
            <h1 className="font-display text-xl font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
              <RotateCcw size={18} className="text-ocean-400" /> Returns
            </h1>
            {data && <span className="text-sm text-ocean-400">({data.total})</span>}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search order number…"
                className="w-full pl-8 pr-3 py-2 border border-ocean-200 dark:border-ocean-700 rounded-xl text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as ReturnStatus | ''); setPage(1) }}
              className="border border-ocean-200 dark:border-ocean-700 rounded-xl px-3 py-2 text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>

          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : returns.length === 0 ? (
              <div className="py-16 text-center text-ocean-400">
                <RotateCcw size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No return requests</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800 bg-ocean-50 dark:bg-ocean-800/50">
                      <th className="px-4 py-3">Order #</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Refund Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Requested</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ocean-50 dark:divide-ocean-800">
                    {returns.map(r => (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className="hover:bg-ocean-50 dark:hover:bg-ocean-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-ocean-900 dark:text-white">{r.orderNumber}</td>
                        <td className="px-4 py-3 text-ocean-500">{REASON_LABELS[r.reason] ?? r.reason}</td>
                        <td className="px-4 py-3 font-semibold text-ocean-900 dark:text-white">{formatCurrency(r.refundAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[r.status]}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ocean-400 text-xs">{formatDate(r.requestedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>

      {selected && <DetailModal ret={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
