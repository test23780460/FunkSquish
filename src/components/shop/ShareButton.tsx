"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** Shares a page with the Web Share API, or copies the link. */
export function ShareButton({ title, path, className }: { title: string; path: string; className?: string }) {
  const [done, setDone] = useState("");

  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone("Link copied");
      window.setTimeout(() => setDone(""), 2500);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setDone("Couldn't copy the link");
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        "inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-display font-semibold text-ink ring-2 ring-inset ring-sky-200 hover:ring-sky-300",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      </svg>
      <span aria-live="polite">{done || "Share"}</span>
    </button>
  );
}
