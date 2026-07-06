import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AdminAnalyticsPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const analytics = {
  dailyRevenue: [{ date: '2026-01-01', revenue: 1000, orders: 2 }],
  ordersByStatus: [{ status: 'delivered', count: 5 }],
  topProducts: [{ name: 'Salmon', units: 20, revenue: 20000 }],
  revenueByCategory: [{ category: 'Seafood', revenue: 20000 }],
  metrics: { avgOrderValue: 850, thisMonthOrders: 40, lastMonthOrders: 20, thisMonthRevenue: 34000 },
  deliveryAnalytics: {
    totalDeliveries: 12, activeDeliveries: 3, completedDeliveries: 8,
    cancelledDeliveries: 1, avgDeliveryTimeHours: 5.5,
  },
  salesSummary: {
    today: { revenue: 500, orders: 1 }, yesterday: { revenue: 1000, orders: 2 },
    thisWeek: { revenue: 3000, orders: 5 }, thisMonth: { revenue: 34500, orders: 40 },
    thisYear: { revenue: 100000, orders: 200 }, allTime: { revenue: 150000, orders: 300 },
  },
  estimatedProfit: {
    totalRevenue: 20000, estimatedCost: 8000, estimatedProfit: 12000,
    productsWithCostData: 3, totalProductsSold: 5,
  },
  worstSellers: [{ name: 'Unsold Item', units: 0 }],
  fastMoving: [{ name: 'Salmon', unitsLast30Days: 15 }],
  slowMoving: [{ name: 'Rare Item', unitsLast30Days: 0 }],
  mostViewed: [{ name: 'Salmon', views: 120 }],
  leastViewed: [{ name: 'Rare Item', views: 0 }],
  topCustomers: [{ name: 'Priya Sharma', email: 'priya@test.com', totalSpent: 15000, orderCount: 4 }],
  returningCustomersPct: 42.5,
  abandonedOrders: 7,
}

describe('AdminAnalyticsPage', () => {
  it('renders metric cards with computed growth percentage', async () => {
    mock.onGet('/admin/analytics').reply(200, { success: true, data: analytics })
    renderWithProviders(<AdminAnalyticsPage />)

    expect(await screen.findByText('₹34,000')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('100% vs last month')).toBeInTheDocument() // (40-20)/20*100
  })

  it('shows "No previous month data" when last month had zero orders', async () => {
    mock.onGet('/admin/analytics').reply(200, {
      success: true, data: { ...analytics, metrics: { ...analytics.metrics, lastMonthOrders: 0 } },
    })
    renderWithProviders(<AdminAnalyticsPage />)
    expect(await screen.findByText('No previous month data')).toBeInTheDocument()
  })

  it('shows empty states when there is no data yet', async () => {
    mock.onGet('/admin/analytics').reply(200, {
      success: true,
      data: { dailyRevenue: [], ordersByStatus: [], topProducts: [], revenueByCategory: [], metrics: analytics.metrics },
    })
    renderWithProviders(<AdminAnalyticsPage />)

    expect(await screen.findByText('No paid orders yet')).toBeInTheDocument()
    expect(screen.getByText('No orders yet')).toBeInTheDocument()
    // "Revenue by Category", "Top 10 Products by Units Sold", and the new "Best Sellers" list
    expect(screen.getAllByText('No sales data yet').length).toBe(3)
  })

  it('renders chart section titles', async () => {
    mock.onGet('/admin/analytics').reply(200, { success: true, data: analytics })
    renderWithProviders(<AdminAnalyticsPage />)

    expect(await screen.findByText('Daily Revenue — Last 30 Days')).toBeInTheDocument()
    expect(screen.getByText('Orders by Status')).toBeInTheDocument()
    expect(screen.getByText('Revenue by Category')).toBeInTheDocument()
    expect(screen.getByText('Top 10 Products by Units Sold')).toBeInTheDocument()
  })

  it('renders delivery analytics metric cards', async () => {
    mock.onGet('/admin/analytics').reply(200, { success: true, data: analytics })
    renderWithProviders(<AdminAnalyticsPage />)

    expect(await screen.findByText('Delivery Analytics')).toBeInTheDocument()
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.getByText('5.5h')).toBeInTheDocument()
  })

  it('renders sales summary across periods', async () => {
    mock.onGet('/admin/analytics').reply(200, { success: true, data: analytics })
    renderWithProviders(<AdminAnalyticsPage />)

    expect(await screen.findByText('This Year')).toBeInTheDocument()
    expect(screen.getByText('₹1,50,000')).toBeInTheDocument() // allTime revenue
  })

  it('renders estimated profit with cost-coverage caveat', async () => {
    mock.onGet('/admin/analytics').reply(200, { success: true, data: analytics })
    renderWithProviders(<AdminAnalyticsPage />)

    expect(await screen.findByText('₹12,000')).toBeInTheDocument()
    expect(screen.getByText(/3 of/)).toBeInTheDocument()
    expect(screen.getByText(/5 sold products/)).toBeInTheDocument()
  })

  it('renders worst sellers, fast/slow moving, and viewed products', async () => {
    mock.onGet('/admin/analytics').reply(200, { success: true, data: analytics })
    renderWithProviders(<AdminAnalyticsPage />)

    expect(await screen.findByText('Unsold Item')).toBeInTheDocument()
    expect(screen.getByText('Fast Moving (Last 30 Days)')).toBeInTheDocument()
    expect(screen.getByText('Least Viewed Products')).toBeInTheDocument()
  })

  it('renders top customers and returning/abandoned metrics', async () => {
    mock.onGet('/admin/analytics').reply(200, { success: true, data: analytics })
    renderWithProviders(<AdminAnalyticsPage />)

    expect(await screen.findByText('Priya Sharma')).toBeInTheDocument()
    expect(screen.getByText('₹15,000')).toBeInTheDocument()
    expect(screen.getByText('42.5%')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('does not crash when the new analytics sections are missing from the response', async () => {
    mock.onGet('/admin/analytics').reply(200, {
      success: true,
      data: { dailyRevenue: [], ordersByStatus: [], topProducts: [], revenueByCategory: [], metrics: analytics.metrics },
    })
    renderWithProviders(<AdminAnalyticsPage />)
    expect(await screen.findByText('Sales Summary')).toBeInTheDocument()
    expect(screen.getByText('Estimated Profit')).toBeInTheDocument()
  })
})
