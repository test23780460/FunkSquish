import type { TexturePhysics } from "@/content/textures";

/**
 * Tiny, dependency-free squish simulation for the Squish Lab demo.
 *
 * `squash` is how flattened the blob is: 0 = resting, `depth` = fully pressed,
 * negative = stretched tall during a springy overshoot. Pure functions so the
 * behavior can be unit-tested and reused by any component.
 */
export interface SquishState {
  squash: number;
  velocity: number;
  /** Seconds the current press has lasted. */
  pressTime: number;
  /** Seconds since release. */
  releaseTime: number;
  /** Squash at the moment of release (slow-rise eases back from here). */
  releasedFrom: number;
  /** Crackle steps already played during this press (crunchy). */
  crackleStep: number;
  pressing: boolean;
}

export const restingState = (): SquishState => ({
  squash: 0,
  velocity: 0,
  pressTime: 0,
  releaseTime: 0,
  releasedFrom: 0,
  crackleStep: 0,
  pressing: false,
});

export interface StepResult {
  state: SquishState;
  /** True on the frame a crunch step happens (for sound/particles). */
  crackled: boolean;
  /** True once the blob has fully settled (animation can stop). */
  atRest: boolean;
}

const MAX_DT = 1 / 30; // never integrate a huge jump after a background tab

export function press(state: SquishState): SquishState {
  return { ...state, pressing: true, pressTime: 0, crackleStep: 0 };
}

export function release(state: SquishState): SquishState {
  return { ...state, pressing: false, releaseTime: 0, releasedFrom: state.squash };
}

export function step(state: SquishState, dtRaw: number, p: TexturePhysics): StepResult {
  const dt = Math.min(Math.max(dtRaw, 0), MAX_DT);
  const s = { ...state };
  let crackled = false;

  if (s.pressing) {
    s.pressTime += dt;
    const progress = Math.min(1, s.pressTime / Math.max(p.pressSeconds, 0.01));
    let target = p.depth * easeOutCubic(progress);
    if (p.crackles && p.crackles > 0) {
      // Crunchy: the squash gives way in little steps, each one a "crack".
      const stepIndex = Math.min(p.crackles, Math.ceil(progress * p.crackles));
      if (stepIndex > s.crackleStep) {
        s.crackleStep = stepIndex;
        crackled = true;
      }
      target = (p.depth * s.crackleStep) / p.crackles;
    }
    // Follow the target quickly; velocity tracks movement so release feels continuous.
    const follow = 1 - Math.exp(-dt * 28);
    const next = s.squash + (target - s.squash) * follow;
    s.velocity = dt > 0 ? (next - s.squash) / dt : 0;
    s.squash = next;
    return { state: s, crackled, atRest: false };
  }

  s.releaseTime += dt;
  if (p.riseSeconds) {
    const t = Math.min(1, s.releaseTime / p.riseSeconds);
    s.squash = s.releasedFrom * (1 - easeInOutSine(t));
    s.velocity = 0;
    return { state: s, crackled, atRest: t >= 1 };
  }

  // Damped spring back to 0 (semi-implicit Euler: stable at these step sizes).
  const accel = -p.stiffness * s.squash - p.damping * s.velocity;
  s.velocity += accel * dt;
  s.squash += s.velocity * dt;
  const atRest = Math.abs(s.squash) < 0.0015 && Math.abs(s.velocity) < 0.01;
  if (atRest) {
    s.squash = 0;
    s.velocity = 0;
  }
  return { state: s, crackled, atRest };
}

/** Converts squash into a transform that roughly keeps the blob's volume. */
export function squashTransform(squash: number): { scaleX: number; scaleY: number } {
  const clamped = Math.max(-0.25, Math.min(0.6, squash));
  return { scaleX: 1 + clamped * 0.75, scaleY: 1 - clamped };
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
