import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { CartItem } from '@/types'

interface CartState {
  items: CartItem[]
  totalItems: number
  totalPrice: number
}

const STORAGE_KEY = 'cart_items'

function loadStoredItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistItems(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function recalculate(state: CartState) {
  state.totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0)
  state.totalPrice = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  persistItems(state.items)
}

const initialState: CartState = {
  items: loadStoredItems(),
  totalItems: 0,
  totalPrice: 0,
}
recalculate(initialState)

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const existing = state.items.find((i) => i.productId === action.payload.productId)
      if (existing) {
        existing.quantity = Math.min(existing.quantity + action.payload.quantity, existing.maxQuantity)
      } else {
        state.items.push(action.payload)
      }
      recalculate(state)
    },
    updateQuantity: (state, action: PayloadAction<{ productId: string; quantity: number }>) => {
      const item = state.items.find((i) => i.productId === action.payload.productId)
      if (item) {
        item.quantity = Math.min(action.payload.quantity, item.maxQuantity)
      }
      recalculate(state)
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.productId !== action.payload)
      recalculate(state)
    },
    clearCart: (state) => {
      state.items = []
      recalculate(state)
    },
  },
})

export const { addToCart, updateQuantity, removeFromCart, clearCart } = cartSlice.actions
export default cartSlice.reducer
