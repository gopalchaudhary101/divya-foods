import axiosInstance from './axiosInstance'
import type { Product, Order, User, Category, Banner, Coupon, ApiResponse, PaginatedResponse } from '@/types'
import type { ProductListParams } from './productApi'

// ─── Admin-specific types ─────────────────────────────────────────────────────

export interface DashboardStats {
  todayRevenue: number
  monthRevenue: number
  totalOrders: number
  pendingOrders: number
  totalProducts: number
  lowStockProducts: number
  totalCustomers: number
  newCustomersToday: number
}

export interface AdminOrderFilters {
  page?: number
  status?: string
  paymentMethod?: string
  search?: string
}

// ─── API functions ────────────────────────────────────────────────────────────

export const adminApi = {
  // ── Dashboard ───────────────────────────────────────────────────────────────
  getDashboard: async (): Promise<DashboardStats> => {
    const { data } = await axiosInstance.get<ApiResponse<DashboardStats>>('/admin/dashboard')
    return data.data
  },

  // ── Products ────────────────────────────────────────────────────────────────
  getProducts: async (params: ProductListParams = {}): Promise<PaginatedResponse<Product>> => {
    const { data } = await axiosInstance.get<PaginatedResponse<Product>>('/admin/products', { params })
    return data
  },

  createProduct: async (payload: FormData): Promise<Product> => {
    const { data } = await axiosInstance.post<ApiResponse<Product>>('/admin/products', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data
  },

  updateProduct: async (id: string, payload: Partial<Product>): Promise<Product> => {
    const { data } = await axiosInstance.put<ApiResponse<Product>>(`/admin/products/${id}`, payload)
    return data.data
  },

  deleteProduct: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/admin/products/${id}`)
  },

  // ── Orders ──────────────────────────────────────────────────────────────────
  getOrders: async (filters: AdminOrderFilters = {}): Promise<PaginatedResponse<Order>> => {
    const { data } = await axiosInstance.get<PaginatedResponse<Order>>('/admin/orders', { params: filters })
    return data
  },

  updateOrderStatus: async (id: string, status: string, note?: string): Promise<Order> => {
    const { data } = await axiosInstance.put<ApiResponse<Order>>(`/admin/orders/${id}/status`, { status, note })
    return data.data
  },

  // ── Customers ───────────────────────────────────────────────────────────────
  getCustomers: async (page = 1): Promise<PaginatedResponse<User>> => {
    const { data } = await axiosInstance.get<PaginatedResponse<User>>('/admin/customers', { params: { page } })
    return data
  },

  // ── Categories ──────────────────────────────────────────────────────────────
  createCategory: async (payload: Partial<Category>): Promise<Category> => {
    const { data } = await axiosInstance.post<ApiResponse<Category>>('/admin/categories', payload)
    return data.data
  },

  // ── Banners ─────────────────────────────────────────────────────────────────
  getBanners: async (): Promise<Banner[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Banner[]>>('/admin/banners')
    return data.data
  },

  createBanner: async (payload: Partial<Banner>): Promise<Banner> => {
    const { data } = await axiosInstance.post<ApiResponse<Banner>>('/admin/banners', payload)
    return data.data
  },

  updateBanner: async (id: string, payload: Partial<Banner>): Promise<Banner> => {
    const { data } = await axiosInstance.put<ApiResponse<Banner>>(`/admin/banners/${id}`, payload)
    return data.data
  },

  deleteBanner: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/admin/banners/${id}`)
  },

  // ── Coupons ─────────────────────────────────────────────────────────────────
  getCoupons: async (): Promise<Coupon[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Coupon[]>>('/admin/coupons')
    return data.data
  },

  createCoupon: async (payload: Partial<Coupon>): Promise<Coupon> => {
    const { data } = await axiosInstance.post<ApiResponse<Coupon>>('/admin/coupons', payload)
    return data.data
  },

  deleteCoupon: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/admin/coupons/${id}`)
  },
}
