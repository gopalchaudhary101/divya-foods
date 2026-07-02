import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package, ShoppingBag, Users, IndianRupee,
  Clock, ChevronRight, Search, X, ChevronDown, CheckCircle, TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppSelector } from '@/hooks/useAppSelector'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import axiosInstance from '@/services/api/axiosInstance'
import type { ApiResponse } from '@/types'
import type { Order } from '@/services/api/orderApi'
import { ROUTES } from '@/constants/routes'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminStats {
  totalOrders: number
  pendingOrders: number
  totalProducts: number
  totalCustomers: number
  totalRevenue: number
  recentOrders: Order[]
}

interface PaginatedOrders {
  data: Order[]
  total: number
  page: number
  totalPages: number
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:    'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200',
  confirmed:  'text-mint-700 bg-mint-50 dark:bg-mint-900/20 border-mint-200',
  processing: 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 border-blue-200',
  shipped:    'text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200',
  delivered:  'text-green-700 bg-green-50 dark:bg-green-900/20 border-green-200',
  cancelled:  'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200',
  refunded:   'text-gray-600 bg-gray-100 dark:bg-gray-800 border-gray-300',
}

const NEXT_STATUSES: Record<string, string[]> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered'],
  delivered:  [],
  cancelled:  [],
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[status] ?? STATUS_COLORS.pending}`}>
      {status}
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-ocean-400 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-bold text-ocean-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-ocean-400 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2.5 bg-ocean-50 dark:bg-ocean-800 rounded-xl text-ocean-500">{icon}</div>
      </div>
    </div>
  )
}

// ─── Status update modal ──────────────────────────────────────────────────────

function StatusUpdateModal({
  order,
  onClose,
  onSuccess,
}: {
  order: Order
  onClose: () => void
  onSuccess: () => void
}) {
  const [newStatus, setNewStatus] = useState('')
  const [note, setNote]           = useState('')
  const nextOpts = NEXT_STATUSES[order.status] ?? []

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await axiosInstance.put<ApiResponse<Order>>(
        `/admin/orders/${order.id}/status`,
        { status: newStatus, note },
      )
      return data.data
    },
    onSuccess: () => {
      toast.success(`Order moved to ${newStatus}`)
      onSuccess()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to update status')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-ocean-900 dark:text-white">Update Status</h3>
          <button onClick={onClose} className="p-1 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg"><X size={16} /></button>
        </div>

        <p className="text-sm text-ocean-500 mb-4">
          Order <strong className="text-ocean-800 dark:text-ocean-100">{order.orderNumber}</strong> — current status: <StatusPill status={order.status} />
        </p>

        {nextOpts.length === 0 ? (
          <p className="text-sm text-ocean-400 italic">No further status changes allowed.</p>
        ) : (
          <>
            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-2">New Status</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {nextOpts.map(s => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border capitalize transition-colors
                    ${newStatus === s
                      ? 'bg-ocean-700 text-white border-ocean-700'
                      : 'border-ocean-200 dark:border-ocean-700 text-ocean-600 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-ocean-800'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-2">
              Tracking Note (optional)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={newStatus === 'shipped' ? 'e.g. Dispatched via DTDC, AWB #12345' : 'Add a note for the customer...'}
              rows={2}
              className="input-field w-full resize-none mb-4"
            />

            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button
                variant="primary" size="sm" className="flex-1"
                disabled={!newStatus}
                loading={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Update
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({ order, onSelect }: { order: Order; onSelect: (o: Order) => void }) {
  return (
    <tr className="border-b border-ocean-50 dark:border-ocean-800 hover:bg-ocean-50/50 dark:hover:bg-ocean-800/30 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-ocean-900 dark:text-white whitespace-nowrap">{order.orderNumber}</td>
      <td className="px-4 py-3 text-sm text-ocean-600 dark:text-ocean-300 whitespace-nowrap">
        {order.deliveryAddress?.full_name ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm text-ocean-600 dark:text-ocean-300 whitespace-nowrap">{formatDate(order.createdAt)}</td>
      <td className="px-4 py-3 text-sm font-semibold text-ocean-900 dark:text-white whitespace-nowrap">{formatCurrency(order.total)}</td>
      <td className="px-4 py-3 whitespace-nowrap"><StatusPill status={order.status} /></td>
      <td className="px-4 py-3">
        <button
          onClick={() => onSelect(order)}
          className="flex items-center gap-1 text-xs text-ocean-500 hover:text-ocean-700 font-medium transition-colors"
        >
          Manage <ChevronRight size={13} />
        </button>
      </td>
    </tr>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const user = useAppSelector(s => s.auth.user)
  const queryClient = useQueryClient()

  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [selected, setSelected]   = useState<Order | null>(null)

  // Stats
  const { data: statsData } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<AdminStats>>('/admin/stats')
      return data.data
    },
  })

  // Orders list
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['admin', 'orders', page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await axiosInstance.get<ApiResponse<PaginatedOrders>>(`/admin/orders?${params}`)
      return data.data
    },
  })

  const stats  = statsData
  const orders = ordersData?.data ?? []

  return (
    <>
      <Helmet><title>Admin Dashboard — Divya Foods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        {/* Top bar */}
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-ocean-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-xs text-ocean-400">Welcome, {user?.name ?? 'Admin'}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={ROUTES.ADMIN.PRODUCTS}
              className="text-xs font-medium text-ocean-600 dark:text-ocean-300 hover:text-ocean-900 dark:hover:text-white flex items-center gap-1.5 px-3 py-1.5 border border-ocean-200 dark:border-ocean-700 rounded-lg hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors"
            >
              <Package size={13} /> Products
            </Link>
            <Link
              to={ROUTES.ADMIN.ANALYTICS}
              className="text-xs font-medium text-ocean-600 dark:text-ocean-300 hover:text-ocean-900 dark:hover:text-white flex items-center gap-1.5 px-3 py-1.5 border border-ocean-200 dark:border-ocean-700 rounded-lg hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors"
            >
              <TrendingUp size={13} /> Analytics
            </Link>
            <span className="text-xs bg-ocean-100 dark:bg-ocean-800 text-ocean-600 dark:text-ocean-300 px-3 py-1 rounded-full font-medium">
              Divya Foods
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<ShoppingBag size={20} />} label="Total Orders" value={stats?.totalOrders ?? '—'}
              sub={`${stats?.pendingOrders ?? 0} pending`} />
            <StatCard icon={<IndianRupee size={20} />} label="Revenue" value={stats ? formatCurrency(stats.totalRevenue) : '—'}
              sub="Paid orders only" />
            <StatCard icon={<Package size={20} />} label="Products" value={stats?.totalProducts ?? '—'} />
            <StatCard icon={<Users size={20} />} label="Customers" value={stats?.totalCustomers ?? '—'} />
          </div>

          {/* Orders table */}
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
            {/* Table header + filters */}
            <div className="px-5 py-4 border-b border-ocean-100 dark:border-ocean-800 flex flex-wrap gap-3 items-center justify-between">
              <h2 className="font-display font-semibold text-ocean-900 dark:text-white">
                All Orders
                {ordersData && <span className="ml-2 text-sm font-normal text-ocean-400">({ordersData.total})</span>}
              </h2>

              <div className="flex gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Order # or name..."
                    className="input-field pl-8 w-48 text-sm"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X size={13} className="text-ocean-400" />
                    </button>
                  )}
                </div>

                {/* Status filter */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={e => { setStatus(e.target.value); setPage(1) }}
                    className="input-field pr-7 appearance-none text-sm"
                  >
                    <option value="">All statuses</option>
                    {['pending','confirmed','processing','shipped','delivered','cancelled'].map(s => (
                      <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ocean-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : orders.length === 0 ? (
              <div className="py-16 text-center text-ocean-400">
                <Package size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No orders found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ocean-400 uppercase tracking-widest border-b border-ocean-100 dark:border-ocean-800">
                      <th className="px-4 py-3">Order #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <OrderRow key={order.id} order={order} onSelect={setSelected} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {ordersData && ordersData.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-ocean-100 dark:border-ocean-800">
                <p className="text-xs text-ocean-400">
                  Page {ordersData.page} of {ordersData.totalPages}
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
                    onClick={() => setPage(p => Math.min(ordersData.totalPages, p + 1))}
                    disabled={page === ordersData.totalPages}
                    className="px-3 py-1.5 text-sm border border-ocean-200 dark:border-ocean-700 rounded-lg disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recent orders quick view */}
          {stats?.recentOrders && stats.recentOrders.length > 0 && !search && !statusFilter && page === 1 && (
            <div className="mt-6 bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5">
              <h3 className="font-semibold text-ocean-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock size={16} className="text-ocean-400" /> Recent Activity
              </h3>
              <div className="space-y-3">
                {stats.recentOrders.map(o => (
                  <div key={o.id} className="flex items-center gap-3 text-sm">
                    <CheckCircle size={14} className="text-mint-500 shrink-0" />
                    <span className="font-medium text-ocean-700 dark:text-ocean-200">{o.orderNumber}</span>
                    <span className="text-ocean-400">·</span>
                    <span className="text-ocean-500">{o.deliveryAddress?.full_name ?? '—'}</span>
                    <span className="text-ocean-400">·</span>
                    <span className="font-semibold text-ocean-800 dark:text-ocean-100">{formatCurrency(o.total)}</span>
                    <span className="ml-auto"><StatusPill status={o.status} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status update modal */}
      {selected && (
        <StatusUpdateModal
          order={selected}
          onClose={() => setSelected(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
            queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
          }}
        />
      )}
    </>
  )
}
