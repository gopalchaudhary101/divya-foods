import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard, Search, ChevronDown, Package, ImageIcon,
  Plus, History, RotateCcw, Boxes, Truck, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import axiosInstance from '@/services/api/axiosInstance'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { ROUTES } from '@/constants/routes'
import type { ApiResponse } from '@/types'
import type { InventoryProduct, Purchase, StockStatus } from './types'
import { AdjustStockModal, RecordReturnModal, StockHistoryModal } from './InventoryModals'
import { PurchaseFormModal } from './PurchaseModals'

// ─── Status badge ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string }> = {
  in_stock:     { label: 'In Stock',     color: 'text-mint-700 bg-mint-50 dark:bg-mint-900/20' },
  low_stock:    { label: 'Low Stock',    color: 'text-amber-700 bg-amber-50 dark:bg-amber-900/20' },
  out_of_stock: { label: 'Out of Stock', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
}

function StockBadge({ status }: { status: StockStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.in_stock
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

const PURCHASE_STATUS_COLORS: Record<string, string> = {
  ordered:   'text-blue-700 bg-blue-50 dark:bg-blue-900/20',
  received:  'text-mint-700 bg-mint-50 dark:bg-mint-900/20',
  cancelled: 'text-red-600 bg-red-50 dark:bg-red-900/20',
}

// ─── Stock overview tab ─────────────────────────────────────────────────────

function StockOverviewTab() {
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [adjustTarget, setAdjustTarget] = useState<InventoryProduct | null>(null)
  const [returnTarget, setReturnTarget] = useState<InventoryProduct | null>(null)
  const [historyTarget, setHistoryTarget] = useState<InventoryProduct | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'inventory', page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('stockStatus', statusFilter)
      const { data } = await axiosInstance.get<ApiResponse<{ data: InventoryProduct[]; total: number; page: number; totalPages: number }>>(
        `/admin/products?${params}`,
      )
      return data.data
    },
  })

  const products = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-ocean-100 dark:border-ocean-800 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search products…"
              className="input-field pl-8 w-52 text-sm"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="input-field pr-7 appearance-none text-sm"
            >
              <option value="">All statuses</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ocean-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center">
          <Boxes size={44} className="mx-auto mb-3 text-ocean-200 dark:text-ocean-700" />
          <p className="text-sm text-ocean-400">No products match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">Reserved</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Incoming</th>
                <th className="px-4 py-3">Damaged</th>
                <th className="px-4 py-3">Returned</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ocean-50 dark:divide-ocean-800">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-ocean-50/50 dark:hover:bg-ocean-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-ocean-50 dark:bg-ocean-800 shrink-0">
                        {p.images[0]
                          ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-ocean-200" /></div>}
                      </div>
                      <p className="text-sm font-medium text-ocean-900 dark:text-white truncate max-w-[180px]">{p.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-ocean-900 dark:text-white">{p.stockQuantity}</td>
                  <td className="px-4 py-3 text-ocean-500">{p.reservedStock}</td>
                  <td className="px-4 py-3 text-ocean-500">{p.availableStock}</td>
                  <td className="px-4 py-3 text-ocean-500">{p.incomingStock}</td>
                  <td className="px-4 py-3 text-ocean-500">{p.damagedStock}</td>
                  <td className="px-4 py-3 text-ocean-500">{p.returnedStock}</td>
                  <td className="px-4 py-3"><StockBadge status={p.stockStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setAdjustTarget(p)} title="Adjust Stock" className="p-1.5 text-ocean-400 hover:text-ocean-700 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
                        <Boxes size={14} />
                      </button>
                      <button onClick={() => setReturnTarget(p)} title="Record Return" className="p-1.5 text-ocean-400 hover:text-ocean-700 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
                        <RotateCcw size={14} />
                      </button>
                      <button onClick={() => setHistoryTarget(p)} title="Stock History" className="p-1.5 text-ocean-400 hover:text-ocean-700 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg transition-colors">
                        <History size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-4 border-t border-ocean-100 dark:border-ocean-800">
          <p className="text-xs text-ocean-400">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-ocean-200 dark:border-ocean-700 disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-ocean-200 dark:border-ocean-700 disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {adjustTarget && <AdjustStockModal product={adjustTarget} onClose={() => setAdjustTarget(null)} />}
      {returnTarget && <RecordReturnModal product={returnTarget} onClose={() => setReturnTarget(null)} />}
      {historyTarget && <StockHistoryModal product={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  )
}

// ─── Purchase orders tab ─────────────────────────────────────────────────────

function PurchaseOrdersTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Purchase | null>(null)

  const { data: productsData } = useQuery({
    queryKey: ['admin', 'products', 'all-for-purchase'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<{ data: { id: string; name: string }[] }>>('/admin/products?limit=200')
      return data.data.data
    },
  })
  const products = productsData ?? []
  const productNameById = Object.fromEntries(products.map(p => [p.id, p.name]))

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'purchases', page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await axiosInstance.get<ApiResponse<{ data: Purchase[]; total: number; page: number; totalPages: number }>>(
        `/admin/purchases?${params}`,
      )
      return data.data
    },
  })
  const purchases = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  const receiveMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.put(`/admin/purchases/${id}/receive`),
    onSuccess: () => {
      toast.success('Purchase received — stock updated')
      queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
    },
    onError: () => toast.error('Failed to receive purchase'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/admin/purchases/${id}`),
    onSuccess: () => {
      toast.success('Purchase order cancelled')
      queryClient.invalidateQueries({ queryKey: ['admin', 'purchases'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
    },
    onError: () => toast.error('Failed to cancel purchase'),
  })

  return (
    <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-ocean-100 dark:border-ocean-800 flex flex-wrap gap-3 items-center justify-between">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="input-field pr-7 appearance-none text-sm"
          >
            <option value="">All statuses</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ocean-400 pointer-events-none" />
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
          New Purchase
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : purchases.length === 0 ? (
        <div className="py-20 text-center">
          <Truck size={44} className="mx-auto mb-3 text-ocean-200 dark:text-ocean-700" />
          <p className="text-sm text-ocean-400">No purchase orders yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Total Cost</th>
                <th className="px-4 py-3">Batch / Expiry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ocean-50 dark:divide-ocean-800">
              {purchases.map(p => (
                <tr key={p.id} className="hover:bg-ocean-50/50 dark:hover:bg-ocean-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-ocean-900 dark:text-white">{productNameById[p.productId] ?? '—'}</td>
                  <td className="px-4 py-3 text-ocean-600 dark:text-ocean-300">{p.supplierName}</td>
                  <td className="px-4 py-3 text-ocean-500">{p.quantity}</td>
                  <td className="px-4 py-3 font-semibold text-ocean-900 dark:text-white">{formatCurrency(p.totalCost)}</td>
                  <td className="px-4 py-3 text-xs text-ocean-400">
                    {p.batchNumber && <div>{p.batchNumber}</div>}
                    {p.expiryDate && <div>Exp {formatDate(p.expiryDate)}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${PURCHASE_STATUS_COLORS[p.status] ?? ''}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.status === 'ordered' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => receiveMutation.mutate(p.id)}
                          className="text-xs px-2 py-1 bg-ocean-700 hover:bg-ocean-900 text-white rounded-lg font-medium"
                        >
                          Receive
                        </button>
                        <button onClick={() => setEditTarget(p)} className="text-xs text-ocean-500 hover:text-ocean-700">
                          Edit
                        </button>
                        <button onClick={() => cancelMutation.mutate(p.id)} className="text-xs text-red-500 hover:text-red-700">
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-4 border-t border-ocean-100 dark:border-ocean-800">
          <p className="text-xs text-ocean-400">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-ocean-200 dark:border-ocean-700 disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-ocean-200 dark:border-ocean-700 disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {showForm && <PurchaseFormModal products={products} purchase={null} onClose={() => setShowForm(false)} />}
      {editTarget && <PurchaseFormModal products={products} purchase={editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminInventoryPage() {
  const [tab, setTab] = useState<'stock' | 'purchases'>('stock')

  return (
    <>
      <Helmet><title>Inventory — Admin | Divya Luxury Seafoods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-6 py-4 flex items-center gap-4">
          <Link to={ROUTES.ADMIN.DASHBOARD} className="flex items-center gap-1.5 text-xs text-ocean-400 hover:text-ocean-700 transition-colors">
            <LayoutDashboard size={13} /> Dashboard
          </Link>
          <span className="text-ocean-200">/</span>
          <h1 className="font-display text-xl font-semibold text-ocean-900 dark:text-white">Inventory</h1>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          <div className="flex gap-1">
            {(['stock', 'purchases'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                  tab === t
                    ? 'bg-ocean-700 text-white'
                    : 'text-ocean-500 hover:bg-ocean-100 dark:hover:bg-ocean-800'
                }`}
              >
                {t === 'stock' ? <><Package size={14} /> Stock Overview</> : <><Truck size={14} /> Purchase Orders</>}
              </button>
            ))}
          </div>

          {tab === 'stock' ? <StockOverviewTab /> : <PurchaseOrdersTab />}
        </div>
      </div>
    </>
  )
}
