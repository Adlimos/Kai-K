// Small synthesized sound kit. Nothing is downloaded; every sound is built with WebAudio.
let enabled = true
let haptics = true
let ctx: AudioContext | null = null

export function configureFeedback(o: { sound: boolean; haptics: boolean }) {
  enabled = o.sound
  haptics = o.haptics
}

function ac(): AudioContext | null {
  if (!enabled) return null
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === "suspended") void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, at = 0, slideTo?: number) {
  const a = ac()
  if (!a) return
  const t = a.currentTime + at
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(dur: number, gain: number, freq: number, at = 0) {
  const a = ac()
  if (!a) return
  const t = a.currentTime + at
  const len = Math.floor(a.sampleRate * dur)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = "bandpass"
  f.frequency.value = freq
  f.Q.value = 0.9
  const g = a.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(a.destination)
  src.start(t)
}

function buzz(pattern: number | number[]) {
  if (!haptics) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* not available in this frame */
  }
}

export const sfx = {
  deal() {
    noise(0.07, 0.35, 2600)
    noise(0.07, 0.3, 2400, 0.09)
  },
  chips() {
    noise(0.03, 0.4, 4200)
    noise(0.03, 0.35, 3800, 0.05)
    noise(0.03, 0.3, 4400, 0.1)
  },
  right() {
    tone(660, 0.12, "sine", 0.12)
    tone(990, 0.18, "sine", 0.1, 0.08)
    buzz(15)
  },
  wrong() {
    tone(180, 0.32, "sawtooth", 0.05, 0, 110)
    buzz([40, 50, 40])
  },
  tick() {
    tone(1200, 0.05, "square", 0.03)
  },
  go() {
    tone(880, 0.25, "triangle", 0.1)
  },
  fanfare() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.09, i * 0.1))
    buzz([20, 40, 20, 40, 60])
  },
}
