import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import axiosInstance from '@/services/api/axiosInstance'
import type { ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import { formatCurrency } from '@/utils/formatCurrency'

interface AdminBundle {
  id: string
  name: string
  description: string
  image: string | null
  bundlePrice: number
  isActive: boolean
  items: { productId: string; quantity: number; name: string }[]
}

interface AdminProduct {
  id: string
  name: string
  price: number
}

// ─── Bundle form modal ────────────────────────────────────────────────────────

interface BundleForm {
  name: string
  description: string
  image: string
  bundlePrice: string
  isActive: boolean
  items: { productId: string; quantity: number }[]
}

const BLANK: BundleForm = {
  name: '', description: '', image: '', bundlePrice: '', isActive: true, items: [],
}

function BundleModal({
  initial, onClose, onSave, products,
}: {
  initial: BundleForm
  onClose: () => void
  onSave: (f: BundleForm) => void
  products: AdminProduct[]
}) {
  const [form, setForm] = useState<BundleForm>(initial)
  const set = (k: keyof BundleForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  function addItem() {
    if (products.length === 0) return
    const unused = products.find(p => !form.items.some(i => i.productId === p.id))
    if (!unused) return
    setForm(f => ({ ...f, items: [...f.items, { productId: unused.id, quantity: 1 }] }))
  }

  function updateItem(idx: number, field: 'productId' | 'quantity', value: string) {
    setForm(f => ({
      ...f,
      items: f.items.map((item, i) =>
        i === idx ? { ...item, [field]: field === 'quantity' ? Number(value) : value } : item,
      ),
    }))
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  const valid = form.name.trim() && form.bundlePrice && form.items.length > 0

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ocean-100 dark:border-ocean-800 sticky top-0 bg-white dark:bg-ocean-900 z-10">
          <h3 className="font-display font-semibold text-ocean-900 dark:text-white">
            {initial.name ? 'Edit Bundle' : 'New Bundle'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {[
            { label: 'Bundle Name *', key: 'name' as const, placeholder: 'e.g. Salmon Lovers Pack' },
            { label: 'Image URL', key: 'image' as const, placeholder: 'https://...' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">{label}</label>
              <input value={form[key] as string} onChange={set(key)} placeholder={placeholder}
                className="w-full border border-ocean-200 dark:border-ocean-700 rounded-xl px-3 py-2 text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500" />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Short description shown on the bundle card"
              className="w-full border border-ocean-200 dark:border-ocean-700 rounded-xl px-3 py-2 text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Bundle Price (₹) *</label>
            <input type="number" value={form.bundlePrice} onChange={set('bundlePrice')} placeholder="899"
              className="w-full border border-ocean-200 dark:border-ocean-700 rounded-xl px-3 py-2 text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-ocean-500 uppercase tracking-widest">Products *</label>
              <button onClick={addItem} className="text-xs text-ocean-600 dark:text-ocean-300 hover:text-ocean-900 flex items-center gap-1">
                <Plus size={12} /> Add product
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.productId}
                    onChange={e => updateItem(idx, 'productId', e.target.value)}
                    className="flex-1 border border-ocean-200 dark:border-ocean-700 rounded-xl px-2 py-1.5 text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-ocean-500"
                  >
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    className="w-14 border border-ocean-200 dark:border-ocean-700 rounded-xl px-2 py-1.5 text-sm text-center dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-ocean-500"
                  />
                  <button onClick={() => removeItem(idx)} className="p-1 text-ocean-300 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {form.items.length === 0 && (
                <p className="text-xs text-ocean-300 italic">Click "+ Add product" to add items to this bundle.</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={form.isActive ? 'text-mint-500' : 'text-ocean-300'}
            >
              {form.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
            <span className="text-sm text-ocean-700 dark:text-ocean-200">Active (visible to customers)</span>
          </label>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" className="flex-1" disabled={!valid} onClick={() => onSave(form)}>
              Save Bundle
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminBundlesPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; data: BundleForm; editId?: string }>({
    open: false, data: BLANK,
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ['admin', 'bundles'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<AdminBundle[]>>('/admin/bundles')
      return data.data
    },
  })

  const { data: products = [] } = useQuery({
    queryKey: ['admin', 'products', 'all'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<{ data: AdminProduct[] }>('/admin/products?limit=200')
      return data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ form, editId }: { form: BundleForm; editId?: string }) => {
      const payload = {
        name: form.name,
        description: form.description,
        image: form.image || null,
        bundlePrice: Number(form.bundlePrice),
        isActive: form.isActive,
        items: form.items,
      }
      if (editId) {
        await axiosInstance.put(`/admin/bundles/${editId}`, payload)
      } else {
        await axiosInstance.post('/admin/bundles', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bundles'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      toast.success(modal.editId ? 'Bundle updated' : 'Bundle created')
      setModal({ open: false, data: BLANK })
    },
    onError: () => toast.error('Could not save bundle.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/admin/bundles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bundles'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      toast.success('Bundle deleted')
      setDeleteId(null)
    },
  })

  function openEdit(b: AdminBundle) {
    setModal({
      open: true,
      editId: b.id,
      data: {
        name: b.name,
        description: b.description,
        image: b.image ?? '',
        bundlePrice: String(b.bundlePrice),
        isActive: b.isActive,
        items: b.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      },
    })
  }

  return (
    <>
      <Helmet><title>Bundle Deals — Admin | Divya Foods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ADMIN.DASHBOARD} className="flex items-center gap-1.5 text-xs text-ocean-400 hover:text-ocean-700 transition-colors">
              <LayoutDashboard size={13} /> Dashboard
            </Link>
            <span className="text-ocean-200">/</span>
            <h1 className="font-display text-xl font-semibold text-ocean-900 dark:text-white">Bundle Deals</h1>
          </div>
          <Button
            variant="primary" size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setModal({ open: true, data: BLANK })}
          >
            New Bundle
          </Button>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-white dark:bg-ocean-900 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : bundles.length === 0 ? (
            <div className="py-20 text-center">
              <Package size={48} className="mx-auto text-ocean-200 mb-4" />
              <p className="text-ocean-400 mb-4">No bundles yet. Create your first combo deal.</p>
              <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setModal({ open: true, data: BLANK })}>
                New Bundle
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bundles.map(b => (
                <div key={b.id} className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl px-5 py-4 flex items-center gap-4">
                  {b.image ? (
                    <img src={b.image} alt={b.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-ocean-gradient flex items-center justify-center shrink-0">
                      <Package size={20} className="text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ocean-900 dark:text-white text-sm">{b.name}</p>
                    <p className="text-xs text-ocean-400">{b.items.length} items · {formatCurrency(b.bundlePrice)}</p>
                    <p className="text-xs text-ocean-400 truncate">{b.items.map(i => i.name).join(', ')}</p>
                  </div>
                  <button
                    onClick={() => saveMutation.mutate({ form: { name: b.name, description: b.description, image: b.image ?? '', bundlePrice: String(b.bundlePrice), isActive: !b.isActive, items: b.items.map(i => ({ productId: i.productId, quantity: i.quantity })) }, editId: b.id })}
                    className={b.isActive ? 'text-mint-500' : 'text-ocean-300'}
                  >
                    {b.isActive ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                  </button>
                  <button onClick={() => openEdit(b)} className="p-1.5 text-ocean-400 hover:text-ocean-700 transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setDeleteId(b.id)} className="p-1.5 text-ocean-300 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal.open && (
        <BundleModal
          initial={modal.data}
          onClose={() => setModal({ open: false, data: BLANK })}
          onSave={form => saveMutation.mutate({ form, editId: modal.editId })}
          products={products}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white dark:bg-ocean-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-ocean-900 dark:text-white mb-2">Delete bundle?</h3>
            <p className="text-sm text-ocean-500 mb-5">This cannot be undone. The bundle will be removed immediately.</p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="primary" size="sm" className="flex-1 bg-red-600 hover:bg-red-700 border-red-600"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteId!)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
