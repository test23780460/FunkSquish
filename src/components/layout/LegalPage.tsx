import type { ReactNode } from "react";
import { PageTransition } from "./PageTransition";
import { PageHero } from "./PageHero";
import { Container, Notice } from "@/components/ui/Primitives";

/**
 * Shell for draft legal documents. The DRAFT banner stays until the owner
 * (ideally with a lawyer) has reviewed and finalized the text.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <PageTransition>
      <PageHero eyebrow="Draft document" title={title} lead={`Draft last updated ${lastUpdated}.`} />
      <section className="bg-white pb-28 pt-6 sm:pb-36">
        <Container className="max-w-3xl">
          <Notice tone="berry" title="Draft — owner review required before launch" className="mb-10">
            This document is a working draft and is not yet in effect. It must be reviewed and completed by the owner
            (ideally with a qualified legal professional) before the shop opens. Items in [brackets] still need
            information.
          </Notice>
          <div className="legal-prose">{children}</div>
        </Container>
      </section>
    </PageTransition>
  );
}
