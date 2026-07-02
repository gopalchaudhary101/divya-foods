import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'

// ─── Cart types ───────────────────────────────────────────────────────────────

export interface CartItemData {
  productId: string
  name: string
  price: number
  quantity: number
  image: string | null
  maxQuantity: number
}

export interface CartData {
  items: CartItemData[]
  totalItems: number
  totalPrice: number
}

// ─── API functions ────────────────────────────────────────────────────────────

export const cartApi = {
  /** Fetch the server-side saved cart for the logged-in user. */
  getCart: async (): Promise<CartData> => {
    const { data } = await axiosInstance.get<ApiResponse<CartData>>('/cart')
    return data.data
  },

  /**
   * Replace the server cart with the current client (Redux) cart.
   * Called once after login to sync guest cart additions to the server.
   */
  syncCart: async (items: CartItemData[]): Promise<void> => {
    await axiosInstance.post('/cart/sync', { items })
  },

  /** Add an item (or increment quantity) on the server. */
  addItem: async (item: CartItemData): Promise<CartData> => {
    const { data } = await axiosInstance.post<ApiResponse<CartData>>('/cart/items', item)
    return data.data
  },

  /** Set an item's quantity to an exact number. */
  updateItem: async (productId: string, quantity: number): Promise<CartData> => {
    const { data } = await axiosInstance.put<ApiResponse<CartData>>(`/cart/items/${productId}`, { quantity })
    return data.data
  },

  /** Remove a single product from the cart. */
  removeItem: async (productId: string): Promise<CartData> => {
    const { data } = await axiosInstance.delete<ApiResponse<CartData>>(`/cart/items/${productId}`)
    return data.data
  },

  /** Empty the cart completely (called after order is placed). */
  clearCart: async (): Promise<void> => {
    await axiosInstance.delete('/cart')
  },
}
