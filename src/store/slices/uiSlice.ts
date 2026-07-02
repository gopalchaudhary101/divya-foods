import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

interface UIState {
  isDarkMode: boolean
  isMobileMenuOpen: boolean
  isCartOpen: boolean
  isSearchOpen: boolean
}

const initialState: UIState = {
  isDarkMode: false,
  isMobileMenuOpen: false,
  isCartOpen: false,
  isSearchOpen: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleDarkMode: (state) => {
      state.isDarkMode = !state.isDarkMode
      document.documentElement.classList.toggle('dark', state.isDarkMode)
    },
    toggleMobileMenu: (state) => {
      state.isMobileMenuOpen = !state.isMobileMenuOpen
    },
    setCartOpen: (state, action: PayloadAction<boolean>) => {
      state.isCartOpen = action.payload
    },
    setSearchOpen: (state, action: PayloadAction<boolean>) => {
      state.isSearchOpen = action.payload
    },
  },
})

export const { toggleDarkMode, toggleMobileMenu, setCartOpen, setSearchOpen } = uiSlice.actions
export default uiSlice.reducer
