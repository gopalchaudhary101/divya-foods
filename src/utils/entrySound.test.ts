import { describe, it, expect, vi, afterEach } from 'vitest'
import { playEntrySplash } from './entrySound'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('playEntrySplash', () => {
  it('does not throw when the Web Audio API is unavailable (e.g. jsdom)', () => {
    expect(() => playEntrySplash()).not.toThrow()
  })

  it('builds and starts an oscillator + noise burst when AudioContext is available', () => {
    const start = vi.fn()
    const stop = vi.fn()
    const connect = vi.fn()
    const mockNode = { connect, start, stop, frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } }

    const mockCtx = {
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createOscillator: vi.fn(() => ({ ...mockNode })),
      createGain: vi.fn(() => ({ ...mockNode })),
      createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(100) })),
      createBufferSource: vi.fn(() => ({ ...mockNode, buffer: null })),
      createBiquadFilter: vi.fn(() => ({ ...mockNode, frequency: { value: 0 }, Q: { value: 0 } })),
      close: vi.fn(),
    }
    class MockAudioContext {
      constructor() {
        return mockCtx as unknown as MockAudioContext
      }
    }
    vi.stubGlobal('AudioContext', MockAudioContext)

    expect(() => playEntrySplash()).not.toThrow()
    expect(mockCtx.createOscillator).toHaveBeenCalled()
    expect(mockCtx.createBufferSource).toHaveBeenCalled()
  })

  it('fails silently if AudioContext construction throws', () => {
    class ThrowingAudioContext {
      constructor() {
        throw new Error('blocked by browser')
      }
    }
    vi.stubGlobal('AudioContext', ThrowingAudioContext)
    expect(() => playEntrySplash()).not.toThrow()
  })
})
