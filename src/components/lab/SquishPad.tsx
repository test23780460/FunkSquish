"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Texture } from "@/content/textures";
import { TextureBlob } from "@/components/illustrations/TextureBlob";
import { press, release, restingState, squashTransform, step } from "@/lib/squish-physics";
import { playCrackle, playPress, playRelease } from "@/lib/squish-sound";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/cn";

type Crumb = { id: number; x: number; y: number; color: string };
const CRUMB_COLORS = ["#ff7aa8", "#4ea8ff", "#7fe08a", "#ffd45e", "#a68aff", "#ffffff"];

/**
 * Press-and-hold squish demo. Works with mouse, touch, pen and keyboard
 * (hold Space or Enter). With reduced motion the blob simply switches between
 * pressed and resting, with no wobble or flying crumbs.
 */
export function SquishPad({
  texture,
  soundOn = false,
  size = "lg",
  onSquish,
  className,
}: {
  texture: Texture;
  soundOn?: boolean;
  size?: "lg" | "sm";
  onSquish?: () => void;
  className?: string;
}) {
  const bodyRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const stateRef = useRef(restingState());
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const crumbId = useRef(0);
  const [pressed, setPressed] = useState(false);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const reduced = useReducedMotion();
  const hintId = useId();

  const apply = useCallback((squash: number) => {
    const { scaleX, scaleY } = squashTransform(squash);
    if (bodyRef.current) bodyRef.current.style.transform = `scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
    if (shadowRef.current) shadowRef.current.style.transform = `scaleX(${(1 + Math.max(0, squash) * 0.7).toFixed(4)})`;
  }, []);

  const spawnCrumbs = useCallback(() => {
    const batch: Crumb[] = Array.from({ length: 4 }, () => {
      const angle = -Math.PI * (0.15 + Math.random() * 0.7);
      const dist = 60 + Math.random() * 70;
      return {
        id: crumbId.current++,
        x: Math.cos(angle) * dist * (Math.random() < 0.5 ? -1 : 1),
        y: Math.sin(angle) * dist,
        color: CRUMB_COLORS[Math.floor(Math.random() * CRUMB_COLORS.length)],
      };
    });
    setCrumbs((c) => [...c.slice(-16), ...batch]);
    const ids = new Set(batch.map((b) => b.id));
    window.setTimeout(() => setCrumbs((c) => c.filter((x) => !ids.has(x.id))), 700);
  }, []);

  // Latest settings for the animation frame callback (it outlives renders).
  const configRef = useRef({ physics: texture.physics, soundOn });
  useEffect(() => {
    configRef.current = { physics: texture.physics, soundOn };
  });

  const ensureRunning = useCallback(() => {
    if (rafRef.current !== null) return;
    const frame = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      const { physics, soundOn: sound } = configRef.current;
      const r = step(stateRef.current, dt, physics);
      stateRef.current = r.state;
      if (r.crackled) {
        if (sound) playCrackle();
        spawnCrumbs();
      }
      apply(r.state.squash);
      rafRef.current = r.atRest ? null : requestAnimationFrame(frame);
    };
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(frame);
  }, [apply, spawnCrumbs]);

  // New texture (or motion preference): reset to resting.
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    stateRef.current = restingState();
    apply(0);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [texture.id, reduced, apply]);

  const down = () => {
    if (stateRef.current.pressing) return;
    setPressed(true);
    onSquish?.();
    if (soundOn) {
      playPress(texture.id);
      if (reduced && texture.physics.crackles) playCrackle();
    }
    if (reduced) {
      stateRef.current = { ...restingState(), pressing: true };
      apply(texture.physics.depth * 0.8);
      return;
    }
    stateRef.current = press(stateRef.current);
    ensureRunning();
  };

  const up = () => {
    if (!stateRef.current.pressing) return;
    setPressed(false);
    if (soundOn) playRelease(texture.id);
    if (reduced) {
      stateRef.current = restingState();
      apply(0);
      return;
    }
    stateRef.current = release(stateRef.current);
    ensureRunning();
  };

  const big = size === "lg";

  return (
    <div className={cn("relative grid place-items-center", className)}>
      <button
        type="button"
        aria-describedby={hintId}
        aria-label={`Squish the ${texture.name} demo`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          down();
        }}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            down();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            up();
          }
        }}
        onBlur={up}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "group relative grid touch-none select-none place-items-center rounded-full [-webkit-touch-callout:none]",
          big ? "size-[min(78vw,22rem)]" : "size-44 sm:size-52",
        )}
      >
        {/* press ring */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-[8%] rounded-full bg-white/70 ring-4 ring-white transition-transform duration-300 ease-squish",
            pressed ? "scale-95" : "scale-100 group-hover:scale-[1.03]",
          )}
        />
        <TextureBlob
          texture={texture.id}
          palette={texture.palette}
          mood={pressed ? "grin" : "happy"}
          bodyRef={bodyRef}
          shadowRef={shadowRef}
          className="relative h-[82%] w-[82%] drop-shadow-[0_20px_22px_rgba(19,53,122,0.22)]"
        />
        {!reduced &&
          crumbs.map((c) => (
            <span
              key={c.id}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[62%] size-2.5 animate-crumb rounded-sm ring-1 ring-ink/40"
              style={{ backgroundColor: c.color, "--crumb-x": `${c.x}px`, "--crumb-y": `${c.y}px` } as React.CSSProperties}
            />
          ))}
      </button>
      <p id={hintId} className={cn("mt-2 text-center font-display font-semibold text-ink-soft", big ? "text-base" : "text-sm")}>
        {pressed ? "Squiiish…" : "Press and hold to squish"}
        <span className="sr-only"> (or hold the Space bar). This is an animated illustration, not a real product.</span>
      </p>
    </div>
  );
}
