import axiosInstance from './axiosInstance'
import type { User, Address, ApiResponse } from '@/types'

// ─── Request types ────────────────────────────────────────────────────────────

export interface UpdateProfileRequest {
  name?: string
  phone?: string
  avatar?: string
  date_of_birth?: string
}

export interface CreateAddressRequest {
  label: string
  fullName: string
  phone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  pincode: string
  isDefault?: boolean
}

// ─── API functions ────────────────────────────────────────────────────────────

export const userApi = {
  /** Get the logged-in user's profile. */
  getProfile: async (): Promise<User> => {
    const { data } = await axiosInstance.get<ApiResponse<User>>('/users/profile')
    return data.data
  },

  /** Update name, phone, or avatar URL. */
  updateProfile: async (payload: UpdateProfileRequest): Promise<User> => {
    const { data } = await axiosInstance.put<ApiResponse<User>>('/users/profile', payload)
    return data.data
  },

  /**
   * Upload a new avatar image to Cloudinary via the backend.
   * Backend handles the Cloudinary upload and returns the URL.
   */
  uploadAvatar: async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await axiosInstance.post<ApiResponse<{ url: string }>>(
      '/users/avatar',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data.data.url
  },

  // ── Addresses ──────────────────────────────────────────────────────────────

  /** All saved delivery addresses for the logged-in user. */
  getAddresses: async (): Promise<Address[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Address[]>>('/users/addresses')
    return data.data
  },

  /** Add a new delivery address. */
  addAddress: async (payload: CreateAddressRequest): Promise<Address> => {
    const { data } = await axiosInstance.post<ApiResponse<Address>>('/users/addresses', {
      label: payload.label,
      full_name: payload.fullName,
      phone: payload.phone,
      address_line1: payload.addressLine1,
      address_line2: payload.addressLine2,
      city: payload.city,
      state: payload.state,
      pincode: payload.pincode,
      is_default: payload.isDefault,
    })
    return data.data
  },

  /** Update an existing address. */
  updateAddress: async (id: string, payload: Partial<CreateAddressRequest>): Promise<Address> => {
    const { data } = await axiosInstance.put<ApiResponse<Address>>(
      `/users/addresses/${id}`,
      payload
    )
    return data.data
  },

  /** Delete an address. */
  deleteAddress: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/users/addresses/${id}`)
  },

  /** Set an address as the default delivery address. */
  setDefaultAddress: async (id: string): Promise<void> => {
    await axiosInstance.put(`/users/addresses/${id}/default`)
  },
}
