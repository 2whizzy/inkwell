// Synthesized UI sounds (no asset files) + a Web Speech wrapper for audio levels.

let ctx: AudioContext | null = null
let muted = false

export function setMuted(m: boolean) { muted = m }

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const c = ac()
  const o = c.createOscillator()
  const g = c.createGain()
  const t0 = c.currentTime + start
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(c.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.05)
}

/** Soft satisfying key press. */
export function sfxPop() {
  if (muted) return
  tone(440 + Math.random() * 120, 0, 0.08, 'sine', 0.15, 660)
}

/** Crisp upward-pitch chime on a correct answer. */
export function sfxChime(streak = 0) {
  if (muted) return
  const base = 523.25 * Math.pow(1.059463, Math.min(streak, 12)) // rises as the streak grows
  tone(base, 0, 0.15, 'sine', 0.2)
  tone(base * 1.25, 0.07, 0.15, 'sine', 0.2)
  tone(base * 1.5, 0.14, 0.25, 'sine', 0.22)
}

/** Soft deflating buzzer on a wrong answer. */
export function sfxBuzz() {
  if (muted) return
  tone(220, 0, 0.3, 'sawtooth', 0.08, 110)
  tone(180, 0.05, 0.35, 'triangle', 0.1, 90)
}

/** Big rising arpeggio for the victory screen. */
export function sfxFanfare() {
  if (muted) return
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
  notes.forEach((n, i) => tone(n, i * 0.12, 0.4, 'triangle', 0.18))
}

export function sfxSwoosh() {
  if (muted) return
  tone(900, 0, 0.2, 'sine', 0.08, 300)
}

// ---------- Speech ----------

/** Speak a prompt, cancelling any ongoing speech. Resolves when speech finishes. */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95
    u.pitch = 1.1
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
