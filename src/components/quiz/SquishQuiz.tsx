"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { CategorySlug, TextureId } from "@/commerce/types";
import type { ProductSummary } from "@/commerce/summary";
import { getCategory, isCategorySlug } from "@/commerce/categories";
import { getTexture, isTextureId } from "@/content/textures";
import { personalities, quizQuestions, recommend, scoreQuiz, type QuizAnswers } from "@/lib/quiz";
import { createLocalStore, useHydrated, useLocalStore } from "@/lib/local-store";
import { TextureBlob } from "@/components/illustrations/TextureBlob";
import { Mascot } from "@/components/illustrations/Mascot";
import { MiniProductCard } from "@/components/shop/MiniProductCard";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { useWishlist } from "@/components/wishlist/useWishlist";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, HeartIcon, SparklesIcon } from "@/components/icons/Icons";
import { trackEvent } from "@/components/analytics/track";
import { cn } from "@/lib/cn";

type Saved = { texture: TextureId; collection: CategorySlug } | null;
const lastResult = createLocalStore<Saved>(
  "funksquish-quiz-v1",
  (raw) => {
    try {
      const v = JSON.parse(raw ?? "null") as Saved;
      return v && isTextureId(v.texture) && isCategorySlug(v.collection) ? { texture: v.texture, collection: v.collection } : null;
    } catch {
      return null;
    }
  },
  null,
);

/** Reads ?result= & ?collection= (a shared result). Rendered inside <Suspense>. */
export function SquishQuizFromUrl({ products }: { products: ProductSummary[] }) {
  const params = useSearchParams();
  const t = params.get("result");
  const c = params.get("collection");
  const shared = isTextureId(t) ? { texture: t, collection: isCategorySlug(c) ? c : scoreQuiz({}).collection } : null;
  return <SquishQuiz key={shared ? `${shared.texture}-${shared.collection}` : "fresh"} products={products} shared={shared} />;
}

export function SquishQuiz({ products, shared = null }: { products: ProductSummary[]; shared?: Saved }) {
  const [step, setStep] = useState<number>(shared ? quizQuestions.length : -1); // -1 intro, n = result
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [result, setResult] = useState<Saved>(shared);
  const [fromShare, setFromShare] = useState(!!shared);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const last = useLocalStore(lastResult);
  const hydrated = useHydrated();
  const router = useRouter();

  // Move focus to the new heading whenever the step changes (not on first load).
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const start = () => {
    setAnswers({});
    setResult(null);
    setFromShare(false);
    setStep(0);
    if (shared) router.replace("/quiz", { scroll: false });
    trackEvent("quiz-start");
  };

  const finish = (all: QuizAnswers) => {
    const r = scoreQuiz(all);
    const saved = { texture: r.texture, collection: r.collection };
    setResult(saved);
    lastResult.set(saved);
    setStep(quizQuestions.length);
    trackEvent("quiz-complete"); // no answers or results are sent
  };

  if (step === -1) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center rounded-[2.5rem] bg-white px-6 py-10 text-center shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:px-10">
        <Mascot className="w-32 animate-bob" mood="grin" wave />
        <h2 ref={headingRef} tabIndex={-1} className="mt-5 font-display text-3xl font-bold text-ink focus:outline-none sm:text-4xl">
          What&apos;s your squish personality?
        </h2>
        <p className="mt-3 text-lg text-ink-soft">
          {quizQuestions.length} quick questions, about a minute. Just for fun — there are no wrong answers.
        </p>
        <button type="button" onClick={start} className={buttonClasses({ size: "lg", className: "mt-7" })}>
          Start the quiz
          <ArrowRightIcon className="size-5" />
        </button>
        {hydrated && last && (
          <p className="mt-5 text-ink-soft">
            Last time you were a{" "}
            <button type="button" className="font-semibold text-royal underline underline-offset-4" onClick={() => { setResult(last); setStep(quizQuestions.length); }}>
              {personalities[last.texture].title}
            </button>
            .
          </p>
        )}
      </div>
    );
  }

  if (step >= quizQuestions.length && result) {
    return <Result result={result} products={products} fromShare={fromShare} onRetake={start} headingRef={headingRef} />;
  }

  const q = quizQuestions[step];
  const selected = answers[q.id];
  const lastStep = step === quizQuestions.length - 1;

  return (
    <form
      className="mx-auto max-w-2xl rounded-[2.5rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected) return;
        if (lastStep) finish(answers);
        else setStep(step + 1);
      }}
    >
      <div className="flex items-center justify-between gap-3 font-display text-sm font-semibold text-ink-soft">
        <span>
          Question {step + 1} of {quizQuestions.length}
        </span>
        <span aria-hidden="true">{Math.round((step / quizQuestions.length) * 100)}%</span>
      </div>
      <div aria-hidden="true" className="mt-2 h-2.5 overflow-hidden rounded-full bg-ice">
        <div className="h-full rounded-full bg-royal transition-[width] duration-500 ease-squish" style={{ width: `${((step + (selected ? 1 : 0)) / quizQuestions.length) * 100}%` }} />
      </div>

      <fieldset className="mt-6">
        <legend className="w-full">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold text-ink focus:outline-none sm:text-3xl">
            {q.prompt}
          </h2>
        </legend>
        <div className="mt-5 grid gap-2.5">
          {q.options.map((o) => {
            const on = selected === o.id;
            return (
              <label
                key={o.id}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 font-display text-lg font-semibold transition-all duration-200 ease-squish",
                  "has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-royal",
                  on ? "bg-ice text-ink ring-2 ring-inset ring-royal" : "bg-ice-50 text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice",
                )}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={o.id}
                  checked={on}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                  className="sr-only"
                />
                <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-xl", on ? "bg-white animate-pop" : "bg-white/80")}>
                  {o.emoji}
                </span>
                <span className="flex-1">{o.label}</span>
                {on && <CheckIcon className="size-5 text-royal" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          className={buttonClasses({ variant: "ghost" })}
        >
          <ArrowLeftIcon className="size-5" />
          {step === 0 ? "Intro" : "Back"}
        </button>
        <button type="submit" disabled={!selected} className={buttonClasses({ className: "disabled:cursor-not-allowed disabled:opacity-50" })}>
          {lastStep ? "See my result" : "Next"}
          <ArrowRightIcon className="size-5" />
        </button>
      </div>
    </form>
  );
}

function Result({
  result,
  products,
  fromShare,
  onRetake,
  headingRef,
}: {
  result: NonNullable<Saved>;
  products: ProductSummary[];
  fromShare: boolean;
  onRetake: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const persona = personalities[result.texture];
  const texture = getTexture(result.texture)!;
  const collection = getCategory(result.collection);
  const picks = recommend(products, result.texture, result.collection);
  const wishlist = useWishlist();
  const [status, setStatus] = useState("");

  const share = async () => {
    const url = new URL("/quiz", window.location.origin);
    url.searchParams.set("result", result.texture);
    url.searchParams.set("collection", result.collection);
    try {
      if (navigator.share) return void (await navigator.share({ title: `I'm a ${persona.title}! · FunkSquish`, url: url.toString() }));
      await navigator.clipboard.writeText(url.toString());
      setStatus("Result link copied!");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setStatus(`Copy this link: ${url.toString()}`);
    }
  };

  return (
    <div className="space-y-10">
      <div className={cn("relative overflow-hidden rounded-[2.5rem] p-6 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:p-10", texture.tone.soft)}>
        <span aria-hidden="true" className="absolute inset-0 dots opacity-50" />
        <div className="relative grid items-center gap-6 md:grid-cols-[auto_1fr]">
          <TextureBlob texture={texture.id} palette={texture.palette} mood="grin" className="mx-auto size-44 animate-drop-in sm:size-56" />
          <div className="text-center md:text-left">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft">
              {fromShare ? "Someone shared their result" : "Your squish personality"}
            </p>
            <h2 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-4xl font-bold text-ink focus:outline-none sm:text-5xl">
              {persona.title}
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-ink">{persona.blurb}</p>
            <dl className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
              <div className="rounded-full bg-white/90 px-4 py-2 ring-1 ring-inset ring-sky-200">
                <dt className="sr-only">Texture</dt>
                <dd className="font-display font-semibold text-ink">Texture: {texture.name}</dd>
              </div>
              {collection && (
                <div className="rounded-full bg-white/90 px-4 py-2 ring-1 ring-inset ring-sky-200">
                  <dt className="sr-only">Collection</dt>
                  <dd className="font-display font-semibold text-ink">Collection: {collection.name}</dd>
                </div>
              )}
            </dl>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5 md:justify-start">
              <Link href={`/squish-lab?texture=${texture.id}`} className={buttonClasses({})}>
                <SparklesIcon className="size-5" />
                Try {texture.name} in the Lab
              </Link>
              {!fromShare && (
                <button type="button" onClick={share} className={buttonClasses({ variant: "secondary" })}>
                  Share my result
                </button>
              )}
              <button type="button" onClick={onRetake} className={buttonClasses({ variant: "secondary" })}>
                {fromShare ? "Take the quiz" : "Retake"}
              </button>
            </div>
            <p role="status" aria-live="polite" className="mt-3 min-h-6 break-words font-display font-semibold text-royal">
              {status}
            </p>
          </div>
        </div>
      </div>

      <section aria-labelledby="picks-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="picks-title" className="font-display text-2xl font-bold text-ink sm:text-3xl">
              Picked for a {persona.title}
            </h2>
            <p className="mt-1 text-ink-soft">
              {picks.length === 0 || picks.some((p) => p.preview)
                ? "From our sample designs — previews of what we're planning, not products for sale yet."
                : "Squishies that match your squish personality."}
            </p>
          </div>
          {picks.length > 0 && (
            <button
              type="button"
              onClick={() => {
                wishlist.merge(picks.map((p) => p.slug));
                setStatus(`Saved ${picks.length} picks to your wishlist.`);
              }}
              className={buttonClasses({ variant: "secondary" })}
            >
              <HeartIcon className="size-5" />
              Save picks to wishlist
            </button>
          )}
        </div>
        {picks.length > 0 ? (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {picks.map((p) => (
              <li key={p.slug}>
                <MiniProductCard product={p} action={<WishlistButton slug={p.slug} name={p.name} className="size-9" />} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-[2rem] bg-ice-50 p-6 text-ink-soft ring-1 ring-inset ring-sky-200">
            We don&apos;t have a match for this combo yet. Peek at the{" "}
            <Link href="/shop" className="font-semibold text-royal underline underline-offset-4">shop</Link> in the meantime.
          </p>
        )}
      </section>
    </div>
  );
}
