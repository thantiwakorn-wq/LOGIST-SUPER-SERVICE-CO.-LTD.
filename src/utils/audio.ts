// Web Audio API Synthesizer for Cafe Order & Kitchen/Rider Notifications
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a cheerful, prominent restaurant order chime (Ding-Dong / Bell)
 * Used when a customer submits an order, alerting POS, Kitchen, and Rider!
 */
export function playNewOrderChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Sequence of 3 cheerful harmonic bell tones: C5, E5, G5, C6
    const tones = [
      { freq: 523.25, time: 0.0, dur: 0.25, gain: 0.35 },
      { freq: 659.25, time: 0.12, dur: 0.3, gain: 0.4 },
      { freq: 783.99, time: 0.24, dur: 0.35, gain: 0.45 },
      { freq: 1046.5, time: 0.38, dur: 0.6, gain: 0.5 },
    ];

    tones.forEach(({ freq, time, dur, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      // Smooth attack & decay like a service bell
      gainNode.gain.setValueAtTime(0.001, now + time);
      gainNode.gain.exponentialRampToValueAtTime(gain, now + time + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });

    // Mobile vibration pattern (short - pause - long)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([150, 80, 250]);
    }
  } catch {
    // Ignore audio autoplay restrictions
  }
}

/**
 * Play alert chime for low stock or urgent warning
 */
export function playAlertWarningChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(349.23, now + 0.15);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // Ignore
  }
}
