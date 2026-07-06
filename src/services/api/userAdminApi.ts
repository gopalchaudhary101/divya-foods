import axiosInstance from './axiosInstance'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssignableRole = 'customer' | 'admin' | 'driver'
export type UserRole = AssignableRole | 'developer'

export interface AdminUserSummary {
  id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
}

interface PaginatedUsers {
  data: AdminUserSummary[]
  total: number
  page: number
  totalPages: number
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const userAdminApi = {
  list: async (search?: string, role?: UserRole, page = 1): Promise<PaginatedUsers> => {
    const { data } = await axiosInstance.get<PaginatedUsers>('/admin/users', {
      params: { search: search || undefined, role: role || undefined, page, limit: 20 },
    })
    return data
  },

  updateRole: async (userId: string, role: AssignableRole): Promise<AdminUserSummary> => {
    const { data } = await axiosInstance.put<{ success: boolean; data: AdminUserSummary }>(
      `/admin/users/${userId}/role`,
      { role },
    )
    return data.data
  },
}
