// soundAlert.ts
// Plays a sound alert using Web Audio API when production
// lines fall below the achievement threshold.

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * Schedules a single beep at a given start time.
 * Returns the end time so beeps can be chained.
 */
function scheduleBeep(
  ctx: AudioContext,
  startTime: number,
  frequency: number,
  duration: number,
  gain: number
): number {
  const oscillator = ctx.createOscillator()
  const gainNode   = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startTime)

  gainNode.gain.setValueAtTime(0, startTime)
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01)       // fast attack
  gainNode.gain.setValueAtTime(gain, startTime + duration - 0.05)
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration)      // clean fade

  oscillator.start(startTime)
  oscillator.stop(startTime + duration)

  return startTime + duration
}

export function playAlertSound(severity: 'warning' | 'critical' = 'warning') {
  try {
    const ctx  = getAudioContext()
    const now  = ctx.currentTime
    const GAP  = 0.08   // silence between beeps

    if (severity === 'critical') {
      // Three loud descending beeps — unmistakable factory alarm feel
      let t = now
      t = scheduleBeep(ctx, t,        880, 0.25, 0.9) + GAP
      t = scheduleBeep(ctx, t,        880, 0.25, 0.9) + GAP
          scheduleBeep(ctx, t,        660, 0.40, 0.9)
    } else {
      // Two clear beeps for warning
      let t = now
      t = scheduleBeep(ctx, t,        760, 0.20, 0.85) + GAP
          scheduleBeep(ctx, t,        760, 0.20, 0.85)
    }
  } catch (err) {
    console.warn('Sound alert failed:', err)
  }
}

export function playAlertSequence(alertCount: number) {
  if (alertCount <= 0) return
  playAlertSound(alertCount >= 3 ? 'critical' : 'warning')
}

/**
 * Speaks the given text using the Web Speech API.
 * Waits for the beep to finish before speaking.
 * @param text    The message to read aloud.
 * @param severity Used to calculate the delay so speech starts after the beep ends.
 */
export function speakAlertMessage(
  text: string,
  severity: 'warning' | 'critical' = 'warning'
): void {
  if (!('speechSynthesis' in window)) return

  // Beep durations: warning ≈ 0.56s total, critical ≈ 1.10s total
  const delayMs = severity === 'critical' ? 1200 : 650

  setTimeout(() => {
    // Cancel any ongoing speech first
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate   = 0.92
    utterance.pitch  = 1.0
    utterance.volume = 1.0

    // Prefer a clear English voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))
    ) ?? voices.find(v => v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred

    window.speechSynthesis.speak(utterance)
  }, delayMs)
}