import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { CartItem } from '@/types'

interface CartState {
  items: CartItem[]
  totalItems: number
  totalPrice: number
}

const initialState: CartState = {
  items: [],
  totalItems: 0,
  totalPrice: 0,
}

function recalculate(state: CartState) {
  state.totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0)
  state.totalPrice = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
}

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
      state.totalItems = 0
      state.totalPrice = 0
    },
  },
})

export const { addToCart, updateQuantity, removeFromCart, clearCart } = cartSlice.actions
export default cartSlice.reducer
