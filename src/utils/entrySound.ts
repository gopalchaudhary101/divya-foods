/**
 * A short water-drop/splash sound, synthesized entirely with the Web Audio
 * API — no audio file to license or ship. Fits the seafood/ocean theme as a
 * one-time "welcome" cue the first time a visitor interacts with the site.
 *
 * Two layers: a sine tone sweeping down in pitch (the "drop"), plus a brief
 * band-passed noise burst (the "splash" texture).
 */
export function playEntrySplash(): void {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // ── Tonal "drop" — sine sweeping down with a quick decay ──────────────────
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(700, now)
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.28)

    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0.0001, now)
    oscGain.gain.exponentialRampToValueAtTime(0.3, now + 0.02)
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)

    osc.connect(oscGain)
    oscGain.connect(ctx.destination)

    // ── Noise burst — the "splash" texture ─────────────────────────────────────
    const bufferSize = Math.floor(ctx.sampleRate * 0.2)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 1800
    noiseFilter.Q.value = 0.7

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.15, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.4)
    noise.start(now)
    noise.stop(now + 0.2)

    setTimeout(() => ctx.close(), 600)
  } catch {
    // Web Audio unsupported/blocked — this is a nice-to-have, fail silently.
  }
}
