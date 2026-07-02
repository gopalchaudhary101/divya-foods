import { useDispatch } from 'react-redux'
import type { AppDispatch } from '@/store'

// Typed dispatch hook — always use this instead of plain useDispatch
export const useAppDispatch = () => useDispatch<AppDispatch>()
