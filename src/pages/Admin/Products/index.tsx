import React, { useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Search, Edit2, Trash2, X, ChevronDown,
  Package, Star, TrendingUp, Image as ImageIcon,
  CheckCircle, LayoutDashboard,
  CheckSquare, Square, Download, UploadCloud, Images, Megaphone,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { ImageUploader } from '@/components/shared/ImageUploader'
import { formatCurrency } from '@/utils/formatCurrency'
import axiosInstance from '@/services/api/axiosInstance'
import type { ApiResponse } from '@/types'
import { ROUTES } from '@/constants/routes'
import { BulkImportModal, BulkImageModal } from './BulkModals'
import { MarketingModal } from './MarketingModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminProduct {
  id: string
  name: string
  slug: string
  price: number
  originalPrice?: number
  images: string[]
  categoryId: string
  categoryName: string
  brand?: string
  origin?: string
  weight?: string
  inStock: boolean
  stockQuantity: number
  rating: number
  reviewCount: number
  tags: string[]
  isFeatured: boolean
  isBestSeller: boolean
  description: string
  createdAt: string
}

interface AdminCategory {
  id: string
  name: string
  slug: string
}

interface PaginatedProducts {
  data: AdminProduct[]
  total: number
  page: number
  totalPages: number
}

interface ProductFormValues {
  name: string
  slug: string
  categoryId: string
  price: string
  originalPrice: string
  stockQuantity: string
  weight: string
  origin: string
  brand: string
  description: string
  tags: string
  inStock: boolean
  isFeatured: boolean
  isBestSeller: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({
  product,
  onClose,
  onConfirm,
  loading,
}: {
  product: AdminProduct
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-50 rounded-xl">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <h3 className="font-display font-semibold text-ocean-900 dark:text-white">Delete Product</h3>
        </div>
        <p className="text-sm text-ocean-600 dark:text-ocean-300 mb-6">
          Are you sure you want to delete <strong className="text-ocean-900 dark:text-white">{product.name}</strong>?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" className="flex-1" loading={loading} onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Bulk delete confirm modal ────────────────────────────────────────────────

function BulkDeleteModal({
  count,
  onClose,
  onConfirm,
  loading,
}: {
  count: number
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-50 rounded-xl">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <h3 className="font-display font-semibold text-ocean-900 dark:text-white">Delete Products</h3>
        </div>
        <p className="text-sm text-ocean-600 dark:text-ocean-300 mb-6">
          Are you sure you want to delete <strong className="text-ocean-900 dark:text-white">{count} product{count !== 1 ? 's' : ''}</strong>?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" className="flex-1" loading={loading} onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Product form drawer ──────────────────────────────────────────────────────

function ProductFormDrawer({
  product,
  categories,
  onClose,
  onSuccess,
}: {
  product: AdminProduct | null
  categories: AdminCategory[]
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!product
  const queryClient = useQueryClient()

  const [images, setImages] = useState<string[]>(product?.images ?? [''])

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProductFormValues>({
    defaultValues: {
      name:          product?.name          ?? '',
      slug:          product?.slug          ?? '',
      categoryId:    product?.categoryId    ?? '',
      price:         product ? String(product.price)         : '',
      originalPrice: product ? String(product.originalPrice ?? '') : '',
      stockQuantity: product ? String(product.stockQuantity) : '0',
      weight:        product?.weight        ?? '',
      origin:        product?.origin        ?? '',
      brand:         product?.brand         ?? '',
      description:   product?.description   ?? '',
      tags:          product?.tags.join(', ') ?? '',
      inStock:       product?.inStock       ?? true,
      isFeatured:    product?.isFeatured    ?? false,
      isBestSeller:  product?.isBestSeller  ?? false,
    },
  })

  // Auto-generate slug from name on create
  const nameVal = watch('name')
  useEffect(() => {
    if (!isEdit && nameVal) {
      setValue('slug', slugify(nameVal), { shouldValidate: false })
    }
  }, [nameVal, isEdit, setValue])

  const mutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const payload = {
        name:          values.name.trim(),
        slug:          values.slug.trim(),
        categoryId:    values.categoryId,
        price:         parseFloat(values.price) || 0,
        originalPrice: values.originalPrice ? parseFloat(values.originalPrice) : null,
        stockQuantity: parseInt(values.stockQuantity) || 0,
        weight:        values.weight.trim() || null,
        origin:        values.origin.trim() || null,
        brand:         values.brand.trim()  || null,
        description:   values.description,
        tags:          values.tags.split(',').map(t => t.trim()).filter(Boolean),
        images:        images.filter(Boolean),
        inStock:       values.inStock,
        isFeatured:    values.isFeatured,
        isBestSeller:  values.isBestSeller,
      }
      if (isEdit) {
        const { data } = await axiosInstance.put<ApiResponse<AdminProduct>>(
          `/admin/products/${product!.id}`, payload,
        )
        return data.data
      } else {
        const { data } = await axiosInstance.post<ApiResponse<AdminProduct>>(
          '/admin/products', payload,
        )
        return data.data
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Product updated' : 'Product created')
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      onSuccess()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to save product')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-xl bg-white dark:bg-ocean-950 h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ocean-100 dark:border-ocean-800 sticky top-0 bg-white dark:bg-ocean-950 z-10">
          <h2 className="font-display font-semibold text-ocean-900 dark:text-white">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg">
            <X size={18} className="text-ocean-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="flex-1 px-6 py-5 space-y-5">

          {/* Name + Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Product Name *</label>
              <input
                {...register('name', { required: 'Name is required' })}
                placeholder="e.g. Salmon Fillet 500g"
                className="input-field w-full"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="form-label">URL Slug *</label>
              <input
                {...register('slug', { required: 'Slug is required' })}
                placeholder="auto-generated from name"
                className="input-field w-full font-mono text-xs"
              />
              {errors.slug && <p className="text-xs text-red-500 mt-1">{errors.slug.message}</p>}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="form-label">Category *</label>
            <div className="relative">
              <select
                {...register('categoryId', { required: 'Category is required' })}
                className="input-field w-full appearance-none pr-8"
              >
                <option value="">Select category…</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ocean-400 pointer-events-none" />
            </div>
            {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
          </div>

          {/* Price + Original Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Price (₹) *</label>
              <input
                type="number" step="0.01" min="0"
                {...register('price', { required: 'Price is required', min: { value: 0, message: 'Must be ≥ 0' } })}
                placeholder="0.00"
                className="input-field w-full"
              />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
            </div>
            <div>
              <label className="form-label">Original Price (₹)</label>
              <input
                type="number" step="0.01" min="0"
                {...register('originalPrice')}
                placeholder="Strike-through price"
                className="input-field w-full"
              />
            </div>
          </div>

          {/* Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Stock Quantity</label>
              <input
                type="number" min="0"
                {...register('stockQuantity')}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="form-label">Weight / Size</label>
              <input
                {...register('weight')}
                placeholder="e.g. 500g, 1kg, 12pcs"
                className="input-field w-full"
              />
            </div>
          </div>

          {/* Origin + Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Origin Country</label>
              <input {...register('origin')} placeholder="e.g. Norway" className="input-field w-full" />
            </div>
            <div>
              <label className="form-label">Brand</label>
              <input {...register('brand')} placeholder="e.g. Fjord" className="input-field w-full" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Brief product description…"
              className="input-field w-full resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="form-label">Tags (comma-separated)</label>
            <input
              {...register('tags')}
              placeholder="e.g. frozen, seafood, premium"
              className="input-field w-full"
            />
          </div>

          {/* Images */}
          <div>
            <label className="form-label mb-2 block">Product Images</label>
            <ImageUploader
              value={images.filter(Boolean)}
              onChange={setImages}
              maxImages={5}
              disabled={mutation.isPending}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            {(
              [
                { field: 'inStock',      label: 'In Stock',      icon: <CheckCircle size={14} /> },
                { field: 'isFeatured',   label: 'Featured',      icon: <Star size={14} /> },
                { field: 'isBestSeller', label: 'Best Seller',   icon: <TrendingUp size={14} /> },
              ] as const
            ).map(({ field, label, icon }) => {
              const val = watch(field)
              return (
                <label key={field} className="flex items-center gap-3 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setValue(field, !val)}
                    className={`relative w-10 h-5.5 rounded-full transition-colors ${val ? 'bg-ocean-600' : 'bg-ocean-200 dark:bg-ocean-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-4.5' : ''}`} />
                  </button>
                  <span className="flex items-center gap-1.5 text-sm text-ocean-700 dark:text-ocean-200">
                    {icon}{label}
                  </span>
                </label>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 pb-6">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1" loading={mutation.isPending}>
              {isEdit ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Quick toggle ─────────────────────────────────────────────────────────────

function QuickToggle({
  productId,
  field,
  value,
  icon,
  title,
}: {
  productId: string
  field: 'inStock' | 'isFeatured' | 'isBestSeller'
  value: boolean
  icon: React.ReactNode
  title: string
}) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.put(`/admin/products/${productId}`, { [field]: !value })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
    onError: () => toast.error('Update failed'),
  })

  return (
    <button
      title={title}
      onClick={() => mutation.mutate()}
      className={`p-1 rounded transition-colors ${value ? 'text-ocean-600 hover:text-ocean-800' : 'text-ocean-200 hover:text-ocean-400'}`}
    >
      {icon}
    </button>
  )
}

// ─── Product row ──────────────────────────────────────────────────────────────

function ProductRow({
  product,
  onEdit,
  onDelete,
  onMarketing,
  selected,
  onToggleSelect,
}: {
  product: AdminProduct
  onEdit: (p: AdminProduct) => void
  onDelete: (p: AdminProduct) => void
  onMarketing: (p: AdminProduct) => void
  selected: boolean
  onToggleSelect: (id: string) => void
}) {
  const thumb = product.images[0]
  return (
    <tr className={`border-b border-ocean-50 dark:border-ocean-800 hover:bg-ocean-50/50 dark:hover:bg-ocean-800/30 transition-colors ${selected ? 'bg-ocean-50/70 dark:bg-ocean-800/30' : ''}`}>
      {/* Select */}
      <td className="px-4 py-3">
        <button onClick={() => onToggleSelect(product.id)} className={selected ? 'text-ocean-700' : 'text-ocean-300'}>
          {selected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      </td>

      {/* Image + Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-ocean-50 dark:bg-ocean-800 shrink-0">
            {thumb
              ? <img src={thumb} alt={product.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-ocean-200" /></div>}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ocean-900 dark:text-white truncate max-w-[200px]">{product.name}</p>
            <p className="text-xs text-ocean-400 font-mono truncate max-w-[200px]">{product.slug}</p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-3 text-sm text-ocean-500 whitespace-nowrap">{product.categoryName || '—'}</td>

      {/* Price */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm font-semibold text-ocean-900 dark:text-white">{formatCurrency(product.price)}</span>
        {product.originalPrice && (
          <span className="text-xs text-ocean-300 line-through ml-1">{formatCurrency(product.originalPrice)}</span>
        )}
      </td>

      {/* Stock */}
      <td className="px-4 py-3 text-sm text-ocean-500 whitespace-nowrap">{product.stockQuantity}</td>

      {/* Toggles */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <QuickToggle productId={product.id} field="inStock"      value={product.inStock}      icon={<CheckCircle size={15} />} title="Toggle In Stock" />
          <QuickToggle productId={product.id} field="isFeatured"   value={product.isFeatured}   icon={<Star size={15} />}        title="Toggle Featured" />
          <QuickToggle productId={product.id} field="isBestSeller" value={product.isBestSeller} icon={<TrendingUp size={15} />}  title="Toggle Best Seller" />
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(product)}
            className="p-1.5 text-ocean-400 hover:text-ocean-700 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(product)}
            className="p-1.5 text-ocean-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => onMarketing(product)}
            className="p-1.5 text-ocean-400 hover:text-ocean-700 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors"
            title="Marketing"
          >
            <Megaphone size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const queryClient = useQueryClient()

  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [catFilter, setCat]     = useState('')
  const [editProduct, setEdit]  = useState<AdminProduct | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [toDelete, setToDelete] = useState<AdminProduct | null>(null)
  const [marketingTarget, setMarketingTarget] = useState<AdminProduct | null>(null)

  // Bulk actions
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction]   = useState('inStock')
  const [bulkCategory, setBulkCategory] = useState('')
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [showImport, setShowImport]   = useState(false)
  const [showBulkImages, setShowBulkImages] = useState(false)

  // Fetch categories for filter + form
  const { data: catsData } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<AdminCategory[]>>('/admin/categories')
      return data.data
    },
  })
  const categories = catsData ?? []

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['admin', 'products', page, search, catFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search)    params.set('search', search)
      if (catFilter) params.set('categoryId', catFilter)
      const { data } = await axiosInstance.get<PaginatedProducts>(`/admin/products?${params}`)
      return data
    },
  })

  const products   = productsData?.data ?? []
  const totalPages = productsData?.totalPages ?? 1

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/admin/products/${id}`)
    },
    onSuccess: () => {
      toast.success('Product deleted')
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setToDelete(null)
    },
    onError: () => toast.error('Delete failed'),
  })

  const openAdd  = useCallback(() => { setEdit(null); setShowForm(true) }, [])
  const openEdit = useCallback((p: AdminProduct) => { setEdit(p); setShowForm(true) }, [])

  // Bulk update (toggle fields / change category)
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      await axiosInstance.put('/admin/products/bulk-update', { productIds: Array.from(selected), ...updates })
    },
    onSuccess: () => {
      toast.success(`${selected.size} product${selected.size !== 1 ? 's' : ''} updated`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      setSelected(new Set())
    },
    onError: () => toast.error('Bulk update failed'),
  })

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.post('/admin/products/bulk-delete', { productIds: Array.from(selected) })
    },
    onSuccess: () => {
      toast.success(`${selected.size} product${selected.size !== 1 ? 's' : ''} deleted`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setSelected(new Set())
      setConfirmBulkDelete(false)
    },
    onError: () => toast.error('Bulk delete failed'),
  })

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === products.length && products.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(products.map(p => p.id)))
    }
  }

  function exportCSV() {
    window.open(`${axiosInstance.defaults.baseURL}/admin/products/export`, '_blank')
  }

  function applyBulkAction() {
    switch (bulkAction) {
      case 'inStock':      return bulkUpdateMutation.mutate({ inStock: true })
      case 'outOfStock':   return bulkUpdateMutation.mutate({ inStock: false })
      case 'feature':      return bulkUpdateMutation.mutate({ isFeatured: true })
      case 'unfeature':    return bulkUpdateMutation.mutate({ isFeatured: false })
      case 'bestSeller':   return bulkUpdateMutation.mutate({ isBestSeller: true })
      case 'notBestSeller':return bulkUpdateMutation.mutate({ isBestSeller: false })
      case 'category':
        if (!bulkCategory) { toast.error('Choose a category first'); return }
        return bulkUpdateMutation.mutate({ categoryId: bulkCategory })
      case 'delete':
        return setConfirmBulkDelete(true)
    }
  }

  const allSelected = products.length > 0 && selected.size === products.length

  return (
    <>
      <Helmet><title>Products — Admin | Divya Luxury Seafoods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        {/* Top bar */}
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-6 py-4 flex items-center gap-4">
          <Link
            to={ROUTES.ADMIN.DASHBOARD}
            className="flex items-center gap-1.5 text-xs text-ocean-400 hover:text-ocean-700 transition-colors"
          >
            <LayoutDashboard size={13} /> Dashboard
          </Link>
          <span className="text-ocean-200">/</span>
          <h1 className="font-display text-xl font-semibold text-ocean-900 dark:text-white">Products</h1>
          {productsData && (
            <span className="text-sm text-ocean-400">({productsData.total} total)</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" leftIcon={<UploadCloud size={14} />} onClick={() => setShowImport(true)}>
              Import CSV
            </Button>
            <Button variant="outline" size="sm" leftIcon={<Images size={14} />} onClick={() => setShowBulkImages(true)}>
              Bulk Images
            </Button>
            <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={exportCSV}>
              Export CSV
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="bg-ocean-700 text-white rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <select
                value={bulkAction}
                onChange={e => setBulkAction(e.target.value)}
                className="bg-ocean-600 border border-ocean-500 rounded-lg px-2 py-1 text-sm focus:outline-none"
              >
                <option value="inStock">Mark In Stock</option>
                <option value="outOfStock">Mark Out of Stock</option>
                <option value="feature">Mark Featured</option>
                <option value="unfeature">Unmark Featured</option>
                <option value="bestSeller">Mark Best Seller</option>
                <option value="notBestSeller">Unmark Best Seller</option>
                <option value="category">Move to category…</option>
                <option value="delete">Delete</option>
              </select>
              {bulkAction === 'category' && (
                <select
                  value={bulkCategory}
                  onChange={e => setBulkCategory(e.target.value)}
                  className="bg-ocean-600 border border-ocean-500 rounded-lg px-2 py-1 text-sm focus:outline-none"
                >
                  <option value="">Choose category…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <Button
                size="sm"
                className="bg-white text-ocean-800 hover:bg-ocean-100"
                loading={bulkUpdateMutation.isPending}
                onClick={applyBulkAction}
              >
                Apply
              </Button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-ocean-200 hover:text-white text-sm">
                Clear selection
              </button>
            </div>
          )}

          {/* Table card */}
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="px-5 py-4 border-b border-ocean-100 dark:border-ocean-800 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Search products…"
                    className="input-field pl-8 w-52 text-sm"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X size={13} className="text-ocean-400" />
                    </button>
                  )}
                </div>

                {/* Category filter */}
                <div className="relative">
                  <select
                    value={catFilter}
                    onChange={e => { setCat(e.target.value); setPage(1) }}
                    className="input-field pr-7 appearance-none text-sm"
                  >
                    <option value="">All categories</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ocean-400 pointer-events-none" />
                </div>
              </div>

              <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={openAdd}>
                Add Product
              </Button>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : products.length === 0 ? (
              <div className="py-20 text-center">
                <Package size={44} className="mx-auto mb-3 text-ocean-200 dark:text-ocean-700" />
                <p className="text-sm text-ocean-400">
                  {search || catFilter ? 'No products match your filters.' : 'No products yet. Add your first one!'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                      <th className="px-4 py-3 w-10">
                        <button onClick={toggleAll} className={allSelected ? 'text-ocean-700' : 'text-ocean-300'}>
                          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3 whitespace-nowrap">
                        <span title="Stock / Featured / Best-Seller">Stock · Feat · Best</span>
                      </th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <ProductRow
                        key={p.id}
                        product={p}
                        onEdit={openEdit}
                        onDelete={setToDelete}
                        onMarketing={setMarketingTarget}
                        selected={selected.has(p.id)}
                        onToggleSelect={toggleSelect}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-ocean-100 dark:border-ocean-800">
                <p className="text-xs text-ocean-400">
                  Page {productsData?.page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm border border-ocean-200 dark:border-ocean-700 rounded-lg disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm border border-ocean-200 dark:border-ocean-700 rounded-lg disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <p className="text-xs text-ocean-400 mt-3 flex items-center gap-3">
            <span className="flex items-center gap-1"><CheckCircle size={12} className="text-ocean-600" /> In Stock</span>
            <span className="flex items-center gap-1"><Star size={12} className="text-ocean-600" /> Featured</span>
            <span className="flex items-center gap-1"><TrendingUp size={12} className="text-ocean-600" /> Best Seller</span>
            <span className="text-ocean-300">— Click icons to toggle</span>
          </p>
        </div>
      </div>

      {/* Form drawer */}
      {showForm && (
        <ProductFormDrawer
          product={editProduct}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
          }}
        />
      )}

      {/* Delete confirm */}
      {toDelete && (
        <DeleteModal
          product={toDelete}
          onClose={() => setToDelete(null)}
          onConfirm={() => deleteMutation.mutate(toDelete.id)}
          loading={deleteMutation.isPending}
        />
      )}

      {/* Bulk delete confirm */}
      {confirmBulkDelete && (
        <BulkDeleteModal
          count={selected.size}
          onClose={() => setConfirmBulkDelete(false)}
          onConfirm={() => bulkDeleteMutation.mutate()}
          loading={bulkDeleteMutation.isPending}
        />
      )}

      {/* Bulk import */}
      {showImport && (
        <BulkImportModal
          categoryNames={categories.map(c => c.name)}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Bulk image upload + assign */}
      {showBulkImages && (
        <BulkImageModal onClose={() => setShowBulkImages(false)} />
      )}

      {/* Digital marketing */}
      {marketingTarget && (
        <MarketingModal
          productId={marketingTarget.id}
          productName={marketingTarget.name}
          onClose={() => setMarketingTarget(null)}
        />
      )}
    </>
  )
}
