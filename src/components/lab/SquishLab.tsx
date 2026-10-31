"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { textures, getTexture, type TextureId } from "@/content/textures";
import { TextureBlob } from "@/components/illustrations/TextureBlob";
import { CheckIcon } from "@/components/icons/Icons";
import { trackEvent } from "@/components/analytics/track";
import { unlockSound } from "@/lib/squish-sound";
import { cn } from "@/lib/cn";
import { SquishPad } from "./SquishPad";
import { TextureMeters } from "./TextureMeters";

/** Reads ?texture= so a texture can be linked to directly. Rendered inside <Suspense>. */
export function SquishLabFromUrl(props: { matches: Record<TextureId, ReactNode>; previewOnly?: boolean }) {
  const params = useSearchParams();
  const initial = getTexture(params.get("texture"))?.id ?? "soft";
  return <SquishLab key={initial} initial={initial} {...props} />;
}

export function SquishLab({
  initial = "soft",
  matches,
  previewOnly = true,
}: {
  initial?: TextureId;
  matches: Record<TextureId, ReactNode>;
  /** True while the catalog only holds illustrated samples (wording only). */
  previewOnly?: boolean;
}) {
  const [current, setCurrent] = useState<TextureId>(initial);
  const [soundOn, setSoundOn] = useState(false);
  const [squishes, setSquishes] = useState(0);
  const [tried, setTried] = useState<Set<TextureId>>(() => new Set([initial]));
  const texture = getTexture(current) ?? textures[0];
  const pickerRef = useRef<HTMLDivElement>(null);

  // On phones the picker scrolls sideways: keep the chosen texture in view.
  useEffect(() => {
    const row = pickerRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-texture="${current}"]`);
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [current]);

  const choose = (id: TextureId) => {
    setCurrent(id);
    setTried((t) => new Set(t).add(id));
    const url = new URL(window.location.href);
    url.searchParams.set("texture", id);
    window.history.replaceState(null, "", url);
  };

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Pick a texture to try</legend>
        <div ref={pickerRef} className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {textures.map((t) => {
            const active = t.id === current;
            return (
              <label
                key={t.id}
                data-texture={t.id}
                className={cn(
                  "relative flex w-36 shrink-0 cursor-pointer snap-start flex-col items-center rounded-[1.6rem] px-2 pb-3 pt-2 text-center transition-all duration-300 ease-squish sm:w-auto",
                  "has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-royal",
                  active ? cn(t.tone.soft, "-translate-y-1 shadow-[var(--shadow-card)] ring-2 ring-inset ring-royal") : "bg-white ring-1 ring-inset ring-sky-200 hover:-translate-y-0.5",
                )}
              >
                <input type="radio" name="texture" value={t.id} checked={active} onChange={() => choose(t.id)} className="sr-only" />
                <TextureBlob texture={t.id} palette={t.palette} mood={active ? "grin" : "happy"} className="h-16 w-16 sm:h-20 sm:w-20" />
                <span className="mt-1 font-display text-base font-bold leading-tight text-ink">{t.name}</span>
                <span className="mt-0.5 text-xs leading-snug text-ink-soft">{t.tagline}</span>
                {tried.has(t.id) && !active && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-mint-soft text-[#0f7a60]" title="Tried">
                    <CheckIcon className="size-3" />
                    <span className="sr-only">(tried)</span>
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-stretch">
        {/* Stage */}
        <div className={cn("relative overflow-hidden rounded-[2.5rem] px-4 pb-6 pt-14 ring-1 ring-inset ring-sky-200 transition-colors duration-500", texture.tone.soft)}>
          <span aria-hidden="true" className="absolute inset-0 dots opacity-50" />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
            <span className="rounded-full bg-white/90 px-3 py-1 font-display text-xs font-semibold text-ink-soft ring-1 ring-inset ring-sky-200">
              Animated demo<span className="hidden min-[420px]:inline">, not a real product</span>
            </span>
            <button
              type="button"
              aria-pressed={soundOn}
              onClick={() => {
                if (!soundOn) unlockSound();
                setSoundOn((s) => !s);
              }}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 font-display text-sm font-semibold ring-1 ring-inset transition-colors",
                soundOn ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-sky-200 hover:bg-ice",
              )}
            >
              <SoundIcon on={soundOn} />
              Sound {soundOn ? "on" : "off"}
            </button>
          </div>
          <SquishPad
            texture={texture}
            soundOn={soundOn}
            onSquish={() => {
              setSquishes((n) => n + 1);
              if (squishes === 0) trackEvent("squish-lab-squish");
            }}
            className="relative"
          />
          <p className="relative mt-1 text-center font-display text-sm font-semibold text-ink-soft">
            {squishes === 0 ? "Go on, give it a squeeze!" : `${squishes} ${squishes === 1 ? "squish" : "squishes"} so far · ${tried.size} of ${textures.length} textures tried`}
          </p>
        </div>

        {/* Info */}
        <div className="flex flex-col rounded-[2.5rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:p-8">
          <p className={cn("font-display text-sm font-semibold uppercase tracking-[0.14em]", texture.tone.text)}>{texture.tagline}</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">
            {texture.name}
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-soft">{texture.description}</p>
          <ul className="mt-5 space-y-2">
            {texture.feelsLike.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-ink">
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", texture.tone.soft)}>
                  <CheckIcon className="size-3.5" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <TextureMeters meters={texture.meters} solid={texture.tone.solid} className="mt-6 rounded-3xl bg-ice-50 p-4 ring-1 ring-inset ring-sky-200" />
          <p className="mt-auto pt-5 text-sm leading-relaxed text-ink-soft">
            The demo shows the <em>style</em> of this texture. Real squishies vary, so each product page lists its own
            confirmed details once we have samples in hand.
          </p>
        </div>
      </div>

      <section aria-labelledby="matches-title" className="mt-12">
        <h2 id="matches-title" className="font-display text-2xl font-bold text-ink sm:text-3xl">
          {texture.name} {previewOnly ? "sample designs" : "squishies"}
        </h2>
        <div className="mt-5">{matches[current]}</div>
      </section>
    </div>
  );
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="m16 9 5 6M21 9l-5 6" />}
    </svg>
  );
}
