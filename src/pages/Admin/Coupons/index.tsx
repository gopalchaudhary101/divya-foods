import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Tag, Plus, Pencil, Trash2, X, ChevronLeft,
  ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminCouponApi, type Coupon, type CouponUpsertPayload } from '@/services/api/couponApi'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { ROUTES } from '@/constants/routes'

// ─── Coupon form ──────────────────────────────────────────────────────────────

interface CouponFormValues {
  code: string
  discountType: 'percentage' | 'flat'
  discountValue: number
  minOrderValue: number
  maxDiscount: string
  isActive: boolean
  expiresAt: string
  usageLimit: string
}

function CouponModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Coupon
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CouponFormValues>({
    defaultValues: {
      code:           initial?.code ?? '',
      discountType:   initial?.discountType ?? 'percentage',
      discountValue:  initial?.discountValue ?? 10,
      minOrderValue:  initial?.minOrderValue ?? 0,
      maxDiscount:    initial?.maxDiscount != null ? String(initial.maxDiscount) : '',
      isActive:       initial?.isActive ?? true,
      expiresAt:      initial?.expiresAt ? initial.expiresAt.slice(0, 10) : '',
      usageLimit:     initial?.usageLimit != null ? String(initial.usageLimit) : '',
    },
  })

  const discountType = watch('discountType')

  const mutation = useMutation({
    mutationFn: (values: CouponFormValues) => {
      const payload: CouponUpsertPayload = {
        code:          values.code.toUpperCase().trim(),
        discountType:  values.discountType,
        discountValue: Number(values.discountValue),
        minOrderValue: Number(values.minOrderValue) || 0,
        maxDiscount:   values.maxDiscount ? Number(values.maxDiscount) : null,
        isActive:      values.isActive,
        expiresAt:     values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
        usageLimit:    values.usageLimit ? Number(values.usageLimit) : null,
      }
      return isEdit
        ? adminCouponApi.update(initial!.id, payload)
        : adminCouponApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Coupon updated' : 'Coupon created')
      onSaved()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to save coupon')
    },
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coupon-modal-title"
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ocean-100 dark:border-ocean-800">
          <h3 id="coupon-modal-title" className="font-display font-semibold text-ocean-900 dark:text-white">
            {isEdit ? 'Edit Coupon' : 'Create Coupon'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="px-5 py-4 space-y-4">

          {/* Code */}
          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
              Coupon Code *
            </label>
            <input
              {...register('code', { required: 'Required', pattern: { value: /^[A-Z0-9_-]+$/i, message: 'Letters, numbers, - and _ only' } })}
              className="input-field w-full uppercase"
              placeholder="DIVYA20"
              style={{ textTransform: 'uppercase' }}
            />
            {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                Type *
              </label>
              <select {...register('discountType')} className="input-field w-full">
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                {discountType === 'percentage' ? 'Discount %' : 'Discount ₹'} *
              </label>
              <input
                {...register('discountValue', { required: 'Required', min: { value: 1, message: 'Min 1' } })}
                type="number" step="0.01" min="1"
                className="input-field w-full"
                placeholder={discountType === 'percentage' ? '20' : '200'}
              />
              {errors.discountValue && <p className="text-xs text-red-500 mt-1">{errors.discountValue.message}</p>}
            </div>
          </div>

          {/* Min order + max discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                Min Order ₹
              </label>
              <input {...register('minOrderValue')} type="number" min="0" className="input-field w-full" placeholder="0" />
            </div>
            {discountType === 'percentage' && (
              <div>
                <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                  Max Discount ₹
                </label>
                <input {...register('maxDiscount')} type="number" min="1" className="input-field w-full" placeholder="Optional cap" />
              </div>
            )}
          </div>

          {/* Expiry + usage limit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                Expires On
              </label>
              <input {...register('expiresAt')} type="date" className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                Usage Limit
              </label>
              <input {...register('usageLimit')} type="number" min="1" className="input-field w-full" placeholder="Unlimited" />
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register('isActive')} className="sr-only" />
            <div className={`w-10 h-6 rounded-full transition-colors relative ${watch('isActive') ? 'bg-mint-500' : 'bg-ocean-200 dark:bg-ocean-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${watch('isActive') ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-ocean-700 dark:text-ocean-200">Active</span>
          </label>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="flex-1" loading={mutation.isPending}>
              {isEdit ? 'Save Changes' : 'Create Coupon'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ coupon, onClose, onDeleted }: { coupon: Coupon; onClose: () => void; onDeleted: () => void }) {
  const mutation = useMutation({
    mutationFn: () => adminCouponApi.delete(coupon.id),
    onSuccess: () => { toast.success('Coupon deleted'); onDeleted(); onClose() },
    onError: () => toast.error('Failed to delete coupon'),
  })
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-ocean-900 dark:text-white">Delete Coupon</p>
            <p className="text-sm text-ocean-500">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-ocean-600 dark:text-ocean-300 mb-5">
          Are you sure you want to delete <strong>{coupon.code}</strong>?
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            size="sm" className="flex-1 bg-red-500 hover:bg-red-600 text-white border-red-500"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Toggle active ────────────────────────────────────────────────────────────

function useToggleActive(onSuccess: () => void) {
  return useMutation({
    mutationFn: ({ coupon }: { coupon: Coupon }) =>
      adminCouponApi.update(coupon.id, {
        code:          coupon.code,
        discountType:  coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        maxDiscount:   coupon.maxDiscount ?? null,
        isActive:      !coupon.isActive,
        expiresAt:     coupon.expiresAt ?? null,
        usageLimit:    coupon.usageLimit ?? null,
      }),
    onSuccess: () => { onSuccess() },
    onError: () => toast.error('Failed to update coupon'),
  })
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminCouponsPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing]       = useState<Coupon | null>(null)
  const [deleting, setDeleting]     = useState<Coupon | null>(null)

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: adminCouponApi.list,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] })
  const toggleMutation = useToggleActive(invalidate)

  return (
    <>
      <Helmet><title>Coupons — Admin | Divya Luxury Seafoods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        {/* Top bar */}
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to={ROUTES.ADMIN.DASHBOARD}
              className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors"
            >
              <ChevronLeft size={18} className="text-ocean-400" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white flex items-center gap-2">
                <Tag size={18} className="text-ocean-400" />
                Coupons
              </h1>
              <p className="text-xs text-ocean-400">{coupons.length} total</p>
            </div>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            New Coupon
          </Button>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">

            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : coupons.length === 0 ? (
              <div className="py-16 text-center text-ocean-400">
                <Tag size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No coupons yet</p>
                <p className="text-xs mt-1">Create your first coupon to offer discounts to customers.</p>
                <Button variant="outline" size="sm" className="mt-4" leftIcon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
                  Create Coupon
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Min Order</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3">Uses</th>
                      <th className="px-4 py-3">Active</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map(c => {
                      const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date()
                      return (
                        <tr key={c.id} className="border-b border-ocean-50 dark:border-ocean-800 hover:bg-ocean-50/40 dark:hover:bg-ocean-800/30 transition-colors">

                          <td className="px-4 py-3">
                            <span className="font-mono text-sm font-bold text-ocean-800 dark:text-ocean-100 bg-ocean-50 dark:bg-ocean-800 px-2 py-0.5 rounded">
                              {c.code}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm text-ocean-700 dark:text-ocean-200 whitespace-nowrap">
                            {c.discountType === 'percentage'
                              ? <>{c.discountValue}%{c.maxDiscount ? <span className="text-ocean-400 text-xs ml-1">(max {formatCurrency(c.maxDiscount)})</span> : null}</>
                              : formatCurrency(c.discountValue)
                            }
                          </td>

                          <td className="px-4 py-3 text-sm text-ocean-500 whitespace-nowrap">
                            {c.minOrderValue > 0 ? formatCurrency(c.minOrderValue) : '—'}
                          </td>

                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            {c.expiresAt
                              ? <span className={isExpired ? 'text-red-500' : 'text-ocean-500'}>
                                  {formatDate(c.expiresAt)}{isExpired ? ' (expired)' : ''}
                                </span>
                              : <span className="text-ocean-400">Never</span>
                            }
                          </td>

                          <td className="px-4 py-3 text-sm text-ocean-500 whitespace-nowrap">
                            {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ''}
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleMutation.mutate({ coupon: c })}
                              aria-label={c.isActive ? 'Deactivate coupon' : 'Activate coupon'}
                              className="transition-colors"
                            >
                              {c.isActive
                                ? <ToggleRight size={24} className="text-mint-500" />
                                : <ToggleLeft size={24} className="text-ocean-300" />
                              }
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditing(c)}
                                className="p-1.5 text-ocean-400 hover:text-ocean-700 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors"
                                aria-label={`Edit ${c.code}`}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => setDeleting(c)}
                                className="p-1.5 text-ocean-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                aria-label={`Delete ${c.code}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Usage tips */}
          <div className="mt-6 bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5">
            <h3 className="font-semibold text-ocean-800 dark:text-ocean-100 text-sm mb-3">How Coupons Work</h3>
            <ul className="text-xs text-ocean-500 space-y-1.5">
              <li><strong className="text-ocean-700 dark:text-ocean-300">Percentage</strong> — e.g. 20% off. Set a max discount cap to limit savings on large orders.</li>
              <li><strong className="text-ocean-700 dark:text-ocean-300">Flat</strong> — e.g. ₹200 off any order. Simple and predictable.</li>
              <li><strong className="text-ocean-700 dark:text-ocean-300">Min Order</strong> — coupon only activates if cart subtotal ≥ this amount.</li>
              <li><strong className="text-ocean-700 dark:text-ocean-300">Usage Limit</strong> — cap total redemptions across all customers. Leave blank for unlimited.</li>
              <li><strong className="text-ocean-700 dark:text-ocean-300">Expiry</strong> — coupons auto-deactivate at midnight on the expiry date. Leave blank to never expire.</li>
            </ul>
          </div>
        </div>
      </div>

      {(showCreate || editing) && (
        <CouponModal
          initial={editing ?? undefined}
          onClose={() => { setShowCreate(false); setEditing(null) }}
          onSaved={invalidate}
        />
      )}
      {deleting && (
        <DeleteConfirm
          coupon={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={invalidate}
        />
      )}
    </>
  )
}
