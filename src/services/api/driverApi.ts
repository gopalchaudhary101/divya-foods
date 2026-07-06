import axiosInstance from './axiosInstance'
import type { Order, DeliveryStatus } from './orderApi'

interface PaginatedDriverOrders {
  data: Order[]
  total: number
  page: number
  totalPages: number
}

export const driverApi = {
  /** Orders assigned to the logged-in driver only. */
  getMyOrders: async (deliveryStatus?: DeliveryStatus, page = 1): Promise<PaginatedDriverOrders> => {
    const { data } = await axiosInstance.get<PaginatedDriverOrders>('/driver/orders', {
      params: { deliveryStatus, page, limit: 20 },
    })
    return data
  },

  updateStatus: async (
    orderId: string,
    deliveryStatus: DeliveryStatus,
    note?: string,
    proofOfDeliveryUrl?: string,
  ): Promise<Order> => {
    const { data } = await axiosInstance.put<{ success: boolean; data: Order }>(
      `/driver/orders/${orderId}/status`,
      { deliveryStatus, note, proofOfDeliveryUrl },
    )
    return data.data
  },
}

// ─── Admin: driver account management ──────────────────────────────────────────

export interface DriverAccount {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
}

export interface DriverCreatePayload {
  name: string
  email: string
  phone?: string
  password: string
}

export const adminDriverApi = {
  list: async (): Promise<DriverAccount[]> => {
    const { data } = await axiosInstance.get<{ success: boolean; data: DriverAccount[] }>('/admin/drivers')
    return data.data
  },

  create: async (payload: DriverCreatePayload): Promise<DriverAccount> => {
    const { data } = await axiosInstance.post<{ success: boolean; data: DriverAccount }>('/admin/drivers', payload)
    return data.data
  },

  setActive: async (id: string, isActive: boolean): Promise<DriverAccount> => {
    const { data } = await axiosInstance.put<{ success: boolean; data: DriverAccount }>(
      `/admin/drivers/${id}/active`,
      { is_active: isActive },
    )
    return data.data
  },
}
