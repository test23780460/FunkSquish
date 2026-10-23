"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import type { Product, ProductMedia, ProductVariant } from "@/commerce/types";
import { ProductArt } from "@/components/illustrations/ProductArt";
import { Bubble } from "@/components/decor/Decor";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, SearchIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

/**
 * Product gallery with thumbnails and an enlarge/zoom viewer.
 * Real photos/videos come from `product.media`; until those exist the
 * illustration of the selected color is shown (clearly labelled).
 */
export function ProductGallery({
  product,
  variant,
  themeSoft,
}: {
  product: Product;
  variant: ProductVariant;
  themeSoft: string;
}) {
  const media = product.media;
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const current: ProductMedia | undefined = media[index];
  const isIllustration = media.length === 0;

  return (
    <div className="lg:sticky lg:top-28 lg:self-start">
      <div className={cn("relative aspect-square overflow-hidden rounded-[2.5rem] ring-1 ring-inset ring-sky-200", themeSoft)}>
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          className="group absolute inset-0 grid cursor-zoom-in place-items-center"
          aria-label={`Enlarge ${isIllustration ? "illustration" : current?.type === "video" ? "video" : "photo"} of ${product.name}`}
        >
          <span aria-hidden="true" className="absolute inset-0 dots opacity-50" />
          {isIllustration ? (
            <>
              <span aria-hidden="true" className="absolute size-[72%] rounded-full bg-white/75" />
              <ProductArt
                key={variant.id}
                kind={product.art}
                palette={variant.palette}
                mood="grin"
                title={`Illustration of ${product.name} in ${variant.name}`}
                className="relative h-[66%] w-auto animate-rise drop-shadow-[0_24px_24px_rgba(19,53,122,0.22)]"
              />
            </>
          ) : current?.type === "video" ? (
            current.poster ? (
              <Image src={current.poster} alt={current.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            ) : (
              <span className="font-display text-lg font-semibold text-ink">▶ Play video</span>
            )
          ) : current ? (
            <Image src={current.src} alt={current.alt} fill preload sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          ) : null}
          <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 font-display text-xs font-semibold text-ink ring-1 ring-inset ring-sky-200 transition-transform group-hover:scale-105">
            <SearchIcon className="size-3.5" />
            Enlarge
          </span>
        </button>
        {isIllustration && (
          <>
            <Bubble size={36} className="left-[10%] top-[12%]" />
            <Bubble size={20} className="bottom-[14%] left-[12%]" delay={1.5} />
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 font-display text-xs font-semibold text-ink-soft ring-1 ring-inset ring-sky-200 sm:right-4 sm:top-4">
              Illustration, not a photo
            </span>
          </>
        )}
      </div>

      {media.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product photos">
          {media.map((m, i) => (
            <li key={m.src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index}
                aria-label={`Show ${m.type} ${i + 1} of ${media.length}: ${m.alt}`}
                className={cn(
                  "relative size-16 overflow-hidden rounded-2xl ring-2 ring-inset sm:size-20",
                  i === index ? "ring-royal" : "ring-sky-200 hover:ring-sky-300",
                )}
              >
                <Image src={m.type === "video" ? (m.poster ?? m.src) : m.src} alt="" fill sizes="80px" className="object-cover" />
                {m.type === "video" && <span className="absolute inset-0 grid place-items-center bg-ink/30 text-white">▶</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Viewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        product={product}
        variant={variant}
        media={media}
        index={index}
        setIndex={setIndex}
      />
    </div>
  );
}

function Viewer({
  open,
  onClose,
  product,
  variant,
  media,
  index,
  setIndex,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  variant: ProductVariant;
  media: ProductMedia[];
  index: number;
  setIndex: (i: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const item = media[index];

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const step = (dir: number) => {
    setZoom(null);
    setIndex((index + dir + media.length) % media.length);
  };

  const toggleZoom = (e: MouseEvent<HTMLButtonElement>) => {
    if (zoom) return setZoom(null);
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <dialog
      ref={ref}
      onClose={() => {
        setZoom(null);
        onClose();
      }}
      onKeyDown={(e) => {
        if (media.length > 1 && e.key === "ArrowRight") step(1);
        if (media.length > 1 && e.key === "ArrowLeft") step(-1);
      }}
      aria-label={`${product.name} — enlarged view`}
      className="m-auto h-[min(92dvh,52rem)] w-[min(94vw,52rem)] max-w-none overflow-hidden rounded-[2rem] bg-white p-0 backdrop:bg-ink/70 backdrop:backdrop-blur-sm"
    >
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-sky-200 px-4 py-3">
          <p className="truncate font-display font-semibold text-ink">
            {product.name}
            {media.length > 1 && <span className="ml-2 text-ink-soft">{index + 1} / {media.length}</span>}
          </p>
          <button type="button" onClick={() => ref.current?.close()} className="grid size-11 shrink-0 place-items-center rounded-full bg-ice hover:bg-sky-200">
            <CloseIcon className="size-5" />
            <span className="sr-only">Close enlarged view</span>
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden bg-ice-50">
          {media.length === 0 ? (
            <div className="grid h-full place-items-center">
              <ProductArt kind={product.art} palette={variant.palette} mood="grin" className="h-[80%] w-[90%]" title={`Illustration of ${product.name} in ${variant.name}`} />
            </div>
          ) : item.type === "video" ? (
            // Add captions for videos with speech (a .vtt <track>) when real videos are uploaded.
            <video key={item.src} src={item.src} poster={item.poster} controls playsInline className="h-full w-full object-contain" />
          ) : (
            <button
              type="button"
              onClick={toggleZoom}
              className={cn("relative block h-full w-full", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
              aria-label={zoom ? "Zoom out" : "Zoom in"}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="94vw"
                className="object-contain transition-transform duration-300"
                style={zoom ? { transform: "scale(2.2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              />
            </button>
          )}

          {media.length > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} className="absolute left-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white shadow-md ring-1 ring-sky-200">
                <ArrowLeftIcon className="size-5" />
                <span className="sr-only">Previous</span>
              </button>
              <button type="button" onClick={() => step(1)} className="absolute right-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white shadow-md ring-1 ring-sky-200">
                <ArrowRightIcon className="size-5" />
                <span className="sr-only">Next</span>
              </button>
            </>
          )}
        </div>
        {media.length > 0 && item.type === "image" && (
          <p className="px-4 py-2 text-center text-sm text-ink-soft">Tap the photo to {zoom ? "zoom out" : "zoom in"}.</p>
        )}
      </div>
    </dialog>
  );
}
