import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

interface WishlistState {
  productIds: string[]
}

const initialState: WishlistState = {
  productIds: [],
}

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    addToWishlist: (state, action: PayloadAction<string>) => {
      if (!state.productIds.includes(action.payload)) {
        state.productIds.push(action.payload)
      }
    },
    removeFromWishlist: (state, action: PayloadAction<string>) => {
      state.productIds = state.productIds.filter((id) => id !== action.payload)
    },
    toggleWishlist: (state, action: PayloadAction<string>) => {
      const idx = state.productIds.indexOf(action.payload)
      if (idx === -1) {
        state.productIds.push(action.payload)
      } else {
        state.productIds.splice(idx, 1)
      }
    },
  },
})

export const { addToWishlist, removeFromWishlist, toggleWishlist } = wishlistSlice.actions
export default wishlistSlice.reducer
