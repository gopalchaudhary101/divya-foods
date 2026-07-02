import React from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { LayoutDashboard, TrendingUp, ShoppingBag, IndianRupee, Package } from 'lucide-react'
import axiosInstance from '@/services/api/axiosInstance'
import type { ApiResponse } from '@/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { ROUTES } from '@/constants/routes'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  dailyRevenue:       { date: string; revenue: number; orders: number }[]
  ordersByStatus:     { status: string; count: number }[]
  topProducts:        { name: string; units: number; revenue: number }[]
  revenueByCategory:  { category: string; revenue: number }[]
  metrics: {
    avgOrderValue:    number
    thisMonthOrders:  number
    lastMonthOrders:  number
    thisMonthRevenue: number
  }
}

// ─── Colour palettes ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:    '#F59E0B',
  confirmed:  '#5DCAA5',
  processing: '#3B82F6',
  shipped:    '#6366F1',
  delivered:  '#10B981',
  cancelled:  '#EF4444',
  refunded:   '#9CA3AF',
}

const BAR_COLORS = ['#0C447C', '#185FA5', '#5DCAA5', '#EF9F27', '#6366F1', '#10B981']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

const INR = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, accent = false }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-5 ${accent
      ? 'bg-ocean-700 border-ocean-600 text-white'
      : 'bg-white dark:bg-ocean-900 border-ocean-100 dark:border-ocean-800'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${accent ? 'text-ocean-200' : 'text-ocean-400'}`}>
            {label}
          </p>
          <p className={`text-2xl font-bold ${accent ? 'text-white' : 'text-ocean-900 dark:text-white'}`}>{value}</p>
          {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-ocean-300' : 'text-ocean-400'}`}>{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${accent ? 'bg-white/10' : 'bg-ocean-50 dark:bg-ocean-800'}`}>
          <span className={accent ? 'text-ocean-100' : 'text-ocean-500'}>{icon}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ChartCard({ title, children, className = '' }: {
  title: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5 ${className}`}>
      <h3 className="font-display font-semibold text-ocean-900 dark:text-white text-sm mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 'h-56' }: { h?: string }) {
  return <div className={`skeleton rounded-xl ${h}`} />
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ocean-900 text-white rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-ocean-300 mb-1">{label}</p>
      <p className="font-bold">{INR(payload[0]?.value ?? 0)}</p>
      {payload[1] && <p className="text-ocean-300">{payload[1].value} orders</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { data: raw, isLoading } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<AnalyticsData>>('/admin/analytics')
      return data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const metrics   = raw?.metrics
  const orderGrowth = metrics
    ? metrics.lastMonthOrders > 0
      ? `${((metrics.thisMonthOrders - metrics.lastMonthOrders) / metrics.lastMonthOrders * 100).toFixed(0)}% vs last month`
      : 'No previous month data'
    : undefined

  return (
    <>
      <Helmet><title>Analytics — Admin | Divya Foods</title></Helmet>

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
          <h1 className="font-display text-xl font-semibold text-ocean-900 dark:text-white">Analytics</h1>
          <span className="text-xs text-ocean-400 ml-1">Last 30 days</span>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h="h-28" />)
            ) : (
              <>
                <MetricCard
                  icon={<IndianRupee size={20} />}
                  label="This Month Revenue"
                  value={metrics ? formatCurrency(metrics.thisMonthRevenue) : '—'}
                  accent
                />
                <MetricCard
                  icon={<ShoppingBag size={20} />}
                  label="This Month Orders"
                  value={String(metrics?.thisMonthOrders ?? '—')}
                  sub={orderGrowth}
                />
                <MetricCard
                  icon={<TrendingUp size={20} />}
                  label="Avg Order Value"
                  value={metrics ? formatCurrency(metrics.avgOrderValue) : '—'}
                  sub="Paid orders"
                />
                <MetricCard
                  icon={<Package size={20} />}
                  label="Last Month Orders"
                  value={String(metrics?.lastMonthOrders ?? '—')}
                />
              </>
            )}
          </div>

          {/* Daily revenue chart */}
          <ChartCard title="Daily Revenue — Last 30 Days">
            {isLoading ? <Skeleton /> : raw?.dailyRevenue.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-ocean-300 text-sm">No paid orders yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={raw?.dailyRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6F1FB" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fontSize: 11, fill: '#6B93C4' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#6B93C4' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar dataKey="revenue" fill="#0C447C" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Orders by status + revenue by category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Orders by Status">
              {isLoading ? <Skeleton /> : raw?.ordersByStatus.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-ocean-300 text-sm">No orders yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={raw?.ordersByStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                      label={({ status, count }) => `${status} (${count})`}
                      labelLine={false}
                    >
                      {raw?.ordersByStatus.map((entry, i) => (
                        <Cell
                          key={entry.status}
                          fill={STATUS_COLORS[entry.status] ?? BAR_COLORS[i % BAR_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value) => <span className="text-xs capitalize text-ocean-600 dark:text-ocean-300">{value}</span>}
                    />
                    <Tooltip formatter={(val) => [`${val} orders`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Revenue by Category">
              {isLoading ? <Skeleton /> : raw?.revenueByCategory.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-ocean-300 text-sm">No sales data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={raw?.revenueByCategory}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6F1FB" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#6B93C4' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fontSize: 11, fill: '#6B93C4' }}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip formatter={(val) => [INR(Number(val)), 'Revenue']} />
                    {raw?.revenueByCategory.map((_, i) => null)}
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {raw?.revenueByCategory.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Top products */}
          <ChartCard title="Top 10 Products by Units Sold">
            {isLoading ? <Skeleton h="h-64" /> : raw?.topProducts.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-ocean-300 text-sm">No sales data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={raw?.topProducts}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6F1FB" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#6B93C4' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'units sold', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: '#6B93C4' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6B93C4' }}
                    axisLine={false}
                    tickLine={false}
                    width={140}
                  />
                  <Tooltip
                    formatter={(val, name) => [
                      name === 'units' ? `${val} units` : INR(Number(val)),
                      name === 'units' ? 'Units Sold' : 'Revenue',
                    ]}
                  />
                  <Bar dataKey="units" fill="#5DCAA5" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

        </div>
      </div>
    </>
  )
}
