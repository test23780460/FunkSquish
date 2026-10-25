import type { TextureId } from "@/content/textures";

/**
 * Small synthesized sound effects for the Squish Lab (Web Audio, no files).
 * OFF by default; only plays after the visitor turns sound on, and the
 * AudioContext is only created after that click (browsers require a gesture).
 * These are playful stand-ins, not recordings of real products.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBurst(a: AudioContext, { duration, freq, q, gain }: { duration: number; freq: number; q: number; gain: number }) {
  const length = Math.max(1, Math.floor(a.sampleRate * duration));
  const buffer = a.createBuffer(1, length, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(a.destination);
  src.start();
}

function tone(a: AudioContext, { from, to, duration, gain, type = "sine" }: { from: number; to: number; duration: number; gain: number; type?: OscillatorType }) {
  const osc = a.createOscillator();
  osc.type = type;
  const g = a.createGain();
  const t = a.currentTime;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** Call once from the "sound on" click so later sounds are allowed. */
export function unlockSound() {
  audio();
}

export function playPress(texture: TextureId) {
  const a = audio();
  if (!a) return;
  switch (texture) {
    case "jelly":
      return tone(a, { from: 320, to: 140, duration: 0.18, gain: 0.12 });
    case "soft":
      return noiseBurst(a, { duration: 0.12, freq: 900, q: 0.8, gain: 0.25 });
    case "slow-rise":
      return noiseBurst(a, { duration: 0.25, freq: 500, q: 0.6, gain: 0.2 });
    case "buttery":
      return tone(a, { from: 160, to: 90, duration: 0.25, gain: 0.1, type: "triangle" });
    case "crunchy":
      return; // crunchy plays on each crackle instead
  }
}

export function playCrackle() {
  const a = audio();
  if (!a) return;
  noiseBurst(a, { duration: 0.035 + Math.random() * 0.03, freq: 2200 + Math.random() * 1800, q: 1.4, gain: 0.5 });
}

export function playRelease(texture: TextureId) {
  const a = audio();
  if (!a) return;
  switch (texture) {
    case "jelly":
      return tone(a, { from: 180, to: 420, duration: 0.22, gain: 0.1 });
    case "soft":
      return tone(a, { from: 260, to: 520, duration: 0.12, gain: 0.06 });
    case "slow-rise":
      return tone(a, { from: 200, to: 330, duration: 1.6, gain: 0.04 });
    default:
      return;
  }
}
