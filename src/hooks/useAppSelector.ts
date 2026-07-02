import { useSelector } from 'react-redux'
import type { TypedUseSelectorHook } from 'react-redux'
import type { RootState } from '@/store'

// Typed selector hook — always use this instead of plain useSelector
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
