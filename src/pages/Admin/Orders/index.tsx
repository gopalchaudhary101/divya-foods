import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Search, Download, CheckSquare, Square } from 'lucide-react'
import toast from 'react-hot-toast'
import axiosInstance from '@/services/api/axiosInstance'
import type { Order } from '@/types'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { ROUTES } from '@/constants/routes'

interface PaginatedOrders {
  data: Order[]
  total: number
  page: number
  totalPages: number
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  confirmed:  'text-mint-600 bg-mint-50 dark:bg-mint-900/20',
  processing: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  shipped:    'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
  delivered:  'text-green-600 bg-green-50 dark:bg-green-900/20',
  cancelled:  'text-red-500 bg-red-50 dark:bg-red-900/20',
}

const BULK_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']

export default function AdminOrdersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('confirmed')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', 'page', page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await axiosInstance.get<PaginatedOrders>(`/admin/orders?${params}`)
      return data
    },
  })

  const orders = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await axiosInstance.put('/admin/bulk-order-status', { order_ids: ids, status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      toast.success(`${selected.size} order${selected.size !== 1 ? 's' : ''} updated to "${bulkStatus}"`)
      setSelected(new Set())
    },
    onError: () => toast.error('Bulk update failed.'),
  })

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === orders.length && orders.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(orders.map(o => o.id)))
    }
  }

  function exportCSV() {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    window.open(`${axiosInstance.defaults.baseURL}/admin/export-orders?${params}`, '_blank')
  }

  const allSelected = orders.length > 0 && selected.size === orders.length

  return (
    <>
      <Helmet><title>Orders — Admin | Divya Foods</title></Helmet>

      <div className="min-h-screen bg-ocean-50 dark:bg-[#03182E]">
        {/* Top bar */}
        <div className="bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ADMIN.DASHBOARD} className="flex items-center gap-1.5 text-xs text-ocean-400 hover:text-ocean-700 transition-colors">
              <LayoutDashboard size={13} /> Dashboard
            </Link>
            <span className="text-ocean-200">/</span>
            <h1 className="font-display text-xl font-semibold text-ocean-900 dark:text-white">Orders</h1>
            {data && <span className="text-sm text-ocean-400">({data.total})</span>}
          </div>
          <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={exportCSV}>
            Export CSV
          </Button>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search order # or customer…"
                className="w-full pl-8 pr-3 py-2 border border-ocean-200 dark:border-ocean-700 rounded-xl text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="border border-ocean-200 dark:border-ocean-700 rounded-xl px-3 py-2 text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500"
            >
              <option value="">All statuses</option>
              {['pending','confirmed','processing','shipped','delivered','cancelled','refunded'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div className="bg-ocean-700 text-white rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <select
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value)}
                className="bg-ocean-600 border border-ocean-500 rounded-lg px-2 py-1 text-sm focus:outline-none"
              >
                {BULK_STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <Button
                size="sm"
                className="bg-white text-ocean-800 hover:bg-ocean-100"
                loading={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ ids: Array.from(selected), status: bulkStatus })}
              >
                Apply
              </Button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-ocean-200 hover:text-white text-sm">
                Clear selection
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ocean-100 dark:border-ocean-800 bg-ocean-50 dark:bg-ocean-800/50">
                    <th className="px-4 py-3 text-left w-10">
                      <button onClick={toggleAll} className={allSelected ? 'text-ocean-700' : 'text-ocean-300'}>
                        {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                    {['Order #', 'Customer', 'Items', 'Total', 'Status', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-ocean-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ocean-50 dark:divide-ocean-800">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-ocean-100 dark:bg-ocean-800 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-ocean-400">No orders found</td>
                    </tr>
                  ) : (
                    orders.map(order => (
                      <tr
                        key={order.id}
                        className={`hover:bg-ocean-50 dark:hover:bg-ocean-800/40 transition-colors ${selected.has(order.id) ? 'bg-ocean-50/70 dark:bg-ocean-800/30' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <button onClick={() => toggleSelect(order.id)} className={selected.has(order.id) ? 'text-ocean-700' : 'text-ocean-300'}>
                            {selected.has(order.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-ocean-900 dark:text-white">
                          {(order as unknown as { orderNumber?: string }).orderNumber ?? order.id.slice(-8)}
                        </td>
                        <td className="px-4 py-3 text-ocean-700 dark:text-ocean-200">
                          {order.deliveryAddress.fullName}
                        </td>
                        <td className="px-4 py-3 text-ocean-500">{order.items.length}</td>
                        <td className="px-4 py-3 font-semibold text-ocean-900 dark:text-white">{formatCurrency(order.total)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] ?? ''}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ocean-400 text-xs">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </>
  )
}
