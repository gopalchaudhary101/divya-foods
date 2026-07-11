import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEntrySound } from './useEntrySound'
import { playEntrySplash } from '@/utils/entrySound'

vi.mock('@/utils/entrySound', () => ({ playEntrySplash: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('useEntrySound', () => {
  it('plays the splash sound on the first pointerdown anywhere', () => {
    renderHook(() => useEntrySound())
    window.dispatchEvent(new Event('pointerdown'))
    expect(playEntrySplash).toHaveBeenCalledTimes(1)
  })

  it('plays on the first keydown too, if that comes first', () => {
    renderHook(() => useEntrySound())
    window.dispatchEvent(new Event('keydown'))
    expect(playEntrySplash).toHaveBeenCalledTimes(1)
  })

  it('only plays once even if both pointerdown and keydown fire', () => {
    renderHook(() => useEntrySound())
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('keydown'))
    expect(playEntrySplash).toHaveBeenCalledTimes(1)
  })

  it('does not play again on a fresh mount once the session has already played it', () => {
    sessionStorage.setItem('df_entry_sound_played', '1')
    renderHook(() => useEntrySound())
    window.dispatchEvent(new Event('pointerdown'))
    expect(playEntrySplash).not.toHaveBeenCalled()
  })

  it('marks the session so a remount does not re-arm the listener', () => {
    const { unmount } = renderHook(() => useEntrySound())
    window.dispatchEvent(new Event('pointerdown'))
    unmount()

    renderHook(() => useEntrySound())
    window.dispatchEvent(new Event('pointerdown'))
    expect(playEntrySplash).toHaveBeenCalledTimes(1)
  })
})
