"use client";

import { useState } from "react";
import { textures } from "@/content/textures";
import { SquishPad } from "@/components/lab/SquishPad";
import { cn } from "@/lib/cn";

/** Small squish demo with a quick texture switcher (no sound on the homepage). */
export function TeaserPad() {
  const [index, setIndex] = useState(2); // jelly is the most fun first squeeze
  const texture = textures[index];
  return (
    <div className="flex flex-col items-center">
      <SquishPad texture={texture} size="sm" />
      <div role="group" aria-label="Demo texture" className="mt-3 flex gap-1.5">
        {textures.map((t, i) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              "grid size-11 place-items-center rounded-full ring-2 ring-inset transition-transform duration-200 ease-squish",
              t.tone.soft,
              i === index ? "scale-110 ring-royal" : "ring-transparent hover:scale-105",
            )}
          >
            <span aria-hidden="true" className={cn("size-4 rounded-full", t.tone.solid)} />
            <span className="sr-only">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
