import { Suspense } from "react";
import { listProducts } from "@/commerce/catalog";
import { toProductSummary } from "@/commerce/summary";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container } from "@/components/ui/Primitives";
import { SmileIcon } from "@/components/icons/Icons";
import { SquishQuiz, SquishQuizFromUrl } from "@/components/quiz/SquishQuiz";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Squish Personality Quiz",
  description: "Six quick questions to find your squish personality — and the FunkSquish texture and collection that match it.",
  path: "/quiz",
});

export default async function QuizPage() {
  const products = (await listProducts()).map(toProductSummary);
  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <SmileIcon className="size-4" /> Personality quiz
          </>
        }
        title={
          <>
            Find your <span className="text-squish">squish</span>
          </>
        }
        lead="Cloud Cuddler or Crunch Champion? Answer six silly questions and we'll match you with a texture and a collection."
      />
      <section className="bg-white pb-28 pt-4 sm:pb-36">
        <Container>
          <Suspense fallback={<SquishQuiz products={products} />}>
            <SquishQuizFromUrl products={products} />
          </Suspense>
          <p className="mx-auto mt-8 max-w-xl text-center text-sm text-ink-soft">
            Just for fun. Your answers stay in your browser — we don&apos;t collect them.
          </p>
        </Container>
      </section>
    </PageTransition>
  );
}
