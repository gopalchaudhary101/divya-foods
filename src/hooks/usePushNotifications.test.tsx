import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePushNotifications } from './usePushNotifications'

// jsdom does not implement Notification / serviceWorker / PushManager, so this
// hook should always land on 'unsupported' in the test environment — exactly
// the real-world behavior for a browser without push support.
describe('usePushNotifications', () => {
  it('reports unsupported when the browser lacks the Push API', async () => {
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.status).toBe('unsupported'))
  })

  it('subscribe() fails gracefully (returns false) rather than throwing', async () => {
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.status).toBe('unsupported'))

    const success = await result.current.subscribe()
    expect(success).toBe(false)
  })

  it('unsubscribe() fails gracefully (returns false) rather than throwing', async () => {
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.status).toBe('unsupported'))

    const success = await result.current.unsubscribe()
    expect(success).toBe(false)
  })
})
