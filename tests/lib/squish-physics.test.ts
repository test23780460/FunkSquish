import { describe, expect, it } from "vitest";
import { textures, getTexture } from "@/content/textures";
import { press, release, restingState, squashTransform, step, type SquishState } from "@/lib/squish-physics";

function run(state: SquishState, seconds: number, id: string) {
  const physics = getTexture(id)!.physics;
  let s = state;
  let crackles = 0;
  let atRest = false;
  let min = Infinity;
  for (let t = 0; t < seconds; t += 1 / 60) {
    const r = step(s, 1 / 60, physics);
    s = r.state;
    if (r.crackled) crackles++;
    min = Math.min(min, s.squash);
    atRest = r.atRest;
  }
  return { s, crackles, atRest, min };
}

describe("squish physics", () => {
  it("presses down to each texture's depth and comes back to rest", () => {
    for (const t of textures) {
      const pressed = run(press(restingState()), 1.5, t.id);
      expect(pressed.s.squash).toBeGreaterThan(t.physics.depth * 0.9);
      expect(pressed.s.squash).toBeLessThanOrEqual(t.physics.depth + 1e-6);
      const back = run(release(pressed.s), 6, t.id);
      expect(back.atRest).toBe(true);
      expect(Math.abs(back.s.squash)).toBeLessThan(0.002);
    }
  });

  it("slow-rise takes its time and never overshoots", () => {
    const pressed = run(press(restingState()), 1, "slow-rise");
    const after1s = run(release(pressed.s), 1, "slow-rise");
    expect(after1s.s.squash).toBeGreaterThan(0.2); // still mostly squashed after a second
    expect(after1s.min).toBeGreaterThanOrEqual(0);
  });

  it("jelly wobbles past its resting shape; crunchy crackles step by step", () => {
    const pressed = run(press(restingState()), 1, "jelly");
    expect(run(release(pressed.s), 2, "jelly").min).toBeLessThan(-0.02);
    expect(run(press(restingState()), 1, "crunchy").crackles).toBe(getTexture("crunchy")!.physics.crackles);
  });

  it("ignores huge time jumps (background tabs) instead of exploding", () => {
    const r = step(release({ ...press(restingState()), squash: 0.3 }), 10, getTexture("jelly")!.physics);
    expect(Number.isFinite(r.state.squash)).toBe(true);
    expect(Math.abs(r.state.squash)).toBeLessThan(1);
  });

  it("keeps the transform within sensible bounds", () => {
    expect(squashTransform(0)).toEqual({ scaleX: 1, scaleY: 1 });
    expect(squashTransform(5).scaleY).toBeCloseTo(0.4);
    expect(squashTransform(-5).scaleY).toBeCloseTo(1.25);
  });
});

describe("texture content", () => {
  it("has five distinct textures with 1–5 meters", () => {
    expect(new Set(textures.map((t) => t.id)).size).toBe(5);
    for (const t of textures) for (const v of Object.values(t.meters)) expect(v >= 1 && v <= 5).toBe(true);
  });
});
