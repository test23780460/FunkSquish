import type { ReactNode } from "react";
import { PageTransition } from "./PageTransition";
import { PageHero } from "./PageHero";
import { Container, Notice } from "@/components/ui/Primitives";

/**
 * Shell for legal documents. Drafts show a DRAFT banner until the owner
 * (ideally with a lawyer) has reviewed and finalized the text; pass
 * `draft={false}` only once every decision on the page is owner-approved.
 */
export function LegalPage({
  title,
  lastUpdated,
  draft = true,
  children,
}: {
  title: string;
  lastUpdated: string;
  draft?: boolean;
  children: ReactNode;
}) {
  if (!draft) {
    return (
      <PageTransition>
        <PageHero eyebrow="FunkSquish policy" title={title} lead={`Last updated ${lastUpdated}.`} />
        <section className="bg-white pb-28 pt-6 sm:pb-36">
          <Container className="max-w-3xl">
            <div className="legal-prose">{children}</div>
          </Container>
        </section>
      </PageTransition>
    );
  }
  return (
    <PageTransition>
      <PageHero
        eyebrow="Draft — not yet in effect"
        title={
          <>
            {title} <span className="text-squish">(Draft)</span>
          </>
        }
        lead={`Working draft, last edited ${lastUpdated}. Not a finalized policy.`}
      />
      <section className="bg-white pb-28 pt-6 sm:pb-36">
        <Container className="max-w-3xl">
          <Notice tone="berry" title="Draft — owner review required before launch" className="mb-10">
            This document is a working draft and is not yet in effect. It must be reviewed and completed by the owner
            (ideally with a qualified legal professional) before the shop opens. Items in [brackets] still need
            information.
          </Notice>
          <div className="legal-prose">{children}</div>
          <p className="mt-12 rounded-2xl bg-berry-soft px-4 py-3 text-center font-display font-semibold text-ink">
            End of draft — pending owner review. Not a finalized legal policy.
          </p>
        </Container>
      </section>
    </PageTransition>
  );
}

/** Highlights a missing business fact or an owner decision inside a draft. */
export function Todo({ children }: { children: string }) {
  return <span className="todo">[{children}]</span>;
}

/** Highlights an owner decision that must be made before the policy can go live. */
export function Decision({ children }: { children: string }) {
  return <span className="todo">[Owner decision: {children}]</span>;
}

/**
 * A recommended policy term that is NOT yet approved by the owner.
 * Rendered highlighted so nobody mistakes it for a final commitment.
 */
export function Proposed({ children }: { children: string }) {
  return (
    <span className="proposed" title="Proposed — awaiting owner approval">
      {children} <span className="proposed-tag">proposed</span>
    </span>
  );
}
