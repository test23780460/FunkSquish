import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container, SectionHeading } from "@/components/ui/Primitives";
import { PartnerForm, PartnerFormClosed } from "@/components/partners/PartnerForm";
import { CheckIcon, HomeHeartIcon, LockIcon, MailIcon } from "@/components/icons/Icons";
import { Mascot } from "@/components/illustrations/Mascot";
import { buttonClasses } from "@/components/ui/Button";
import { partnerApplicationsOpen } from "@/app/actions/partners";
import { PARTNER_TYPES } from "@/lib/partners/schema";
import { RETENTION_MONTHS_PUBLIC } from "@/lib/partners/public";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Become a partner",
  description:
    "Manufacturers, wholesale suppliers, dropshipping partners, brands, designers and future resellers: apply to work with FunkSquish.",
  path: "/partners",
});

const steps = [
  { title: "Apply", body: "Tell us about your business and products. Links are perfect — no attachments needed." },
  { title: "We review", body: "We read every application ourselves and may email you with a few questions." },
  { title: "Talk & sample", body: "If it's a fit, we'll discuss terms and, where it makes sense, request samples." },
  { title: "Decide together", body: "Partnerships only start after a conversation and a written agreement. Nothing is automatic." },
];

const values = [
  { title: "Safety first", body: "Squishies are loved by kids. We ask about fillings, water beads, recalls, lab testing and Children's Product Certificates up front." },
  { title: "Original & authorized", body: "Only original designs or products you're authorized to sell. No knock-offs of other brands." },
  { title: "Honest terms", body: "Clear pricing tiers, MOQs, lead times and shipping estimates — and we'll be just as clear back." },
  { title: "Small & personal", body: "We're a new, independent shop based in Kentucky. You'll talk to the person who runs it." },
];

const faqs = [
  { q: "Do you charge an application fee?", a: "No. We never charge fees to apply or to be considered, and we'll never ask for payment by DM." },
  { q: "Should I send samples?", a: "Please don't send anything until we ask. We'll request samples, with an address, if we'd like to move forward." },
  { q: "Can I attach a catalog or price list?", a: "The form doesn't take files on purpose. Type a few SKU prices into the form and share a link to your catalog; we'll ask for a full price list privately if it's a fit." },
  { q: "Are you taking reseller accounts?", a: "No — we don't have a wholesale program yet. Shops and distributors can register future interest, and we'll email if one opens. Registering isn't an account, an order or a price quote." },
  { q: "Where would you sell my products?", a: "Only where you allow it. The form asks which channels you'd authorize — our website, TikTok Shop, TikTok LIVE and others — and nothing is agreed until we both sign." },
];

export default async function PartnersPage() {
  const open = await partnerApplicationsOpen();

  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <HomeHeartIcon className="size-4" /> Partners
          </>
        }
        title={
          <>
            Partner with <span className="text-squish">FunkSquish</span>
          </>
        }
        lead="We're building a cheerful, safety-minded squishy brand — and we're looking for great makers, suppliers and collaborators to build it with."
        art={<Mascot className="w-full animate-bob" mood="happy" wave title="FunkSquish mascot waving hello" />}
      >
        <div className="flex flex-col justify-center gap-3 min-[440px]:flex-row lg:justify-start">
          <a href="#apply" className={buttonClasses({ size: "lg" })}>
            {open ? "Apply now" : "How to apply"}
          </a>
          <a href="#partner-faq-title" className={buttonClasses({ size: "lg", variant: "secondary" })}>
            Partner FAQ
          </a>
        </div>
      </PageHero>

      <section aria-labelledby="who-title" className="bg-white py-14 sm:py-20">
        <Container>
          <SectionHeading eyebrow="Who we work with" title={<span id="who-title">Six ways to work together</span>} />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PARTNER_TYPES.map((t) => (
              <li key={t.id} className="flex flex-col rounded-[2rem] bg-ice-50 p-6 ring-1 ring-inset ring-sky-200">
                <h3 className="font-display text-xl font-bold text-ink">{t.name}</h3>
                <p className="mt-1.5 leading-relaxed text-ink-soft">{t.blurb}</p>
                <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.12em] text-royal">What we look for</p>
                <ul className="mt-2 space-y-1.5">
                  {t.lookFor.map((x) => (
                    <li key={x} className="flex items-start gap-2 text-[0.95rem] text-ink">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-[#0f7a60]" />
                      {x}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="values-title" className="relative overflow-hidden bg-ice-50 py-14 sm:py-20">
        <div aria-hidden="true" className="absolute inset-0 dots opacity-60" />
        <Container className="relative grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading align="left" eyebrow="What matters to us" title={<span id="values-title">How we partner</span>} />
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {values.map((v) => (
                <li key={v.title} className="rounded-[1.75rem] bg-white p-5 ring-1 ring-inset ring-sky-200">
                  <h3 className="font-display text-lg font-bold text-ink">{v.title}</h3>
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">{v.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading align="left" eyebrow="The process" title="What happens after you apply" />
            <ol className="mt-8 space-y-3">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-inset ring-sky-200">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-royal font-display text-lg font-bold text-white shadow-[0_3px_0_var(--color-navy)]">{i + 1}</span>
                  <span>
                    <span className="block font-display text-lg font-bold text-ink">{s.title}</span>
                    <span className="block text-[0.95rem] leading-relaxed text-ink-soft">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <section id="apply" aria-labelledby="apply-title" className="bg-white py-14 sm:py-20">
        <Container className="max-w-4xl">
          <SectionHeading
            eyebrow="Apply"
            title={<span id="apply-title">Tell us about your business</span>}
            lead="Most questions are optional — share what you can. Submitting an application doesn't mean it's approved."
          />
          <div className="mt-10">{open ? <PartnerForm email={siteConfig.email} /> : <PartnerFormClosed email={siteConfig.email} />}</div>

          <div id="partner-privacy" className="mt-8 rounded-[2rem] bg-ice-50 p-5 ring-1 ring-inset ring-sky-200 sm:p-6">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <LockIcon className="size-5 text-royal" /> Privacy notice for applicants
            </h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-ink-soft marker:text-sky">
              <li>We use your answers only to review your application and reply to you. We don&apos;t sell them or add you to any marketing list.</li>
              <li>Prices, terms and safety answers you share are kept confidential. They&apos;re never shown on our website.</li>
              <li>Applications are stored privately by our website host (Netlify) and are visible only to FunkSquish&apos;s owner after signing in.</li>
              <li>We get an email that a new application arrived (via our email provider, Brevo). It doesn&apos;t include your contact details.</li>
              <li>To prevent spam we keep a scrambled code made from your IP address — not the address itself.</li>
              <li>
                We keep applications for up to {RETENTION_MONTHS_PUBLIC} months after the last update, then delete them, unless we start working together.
                Ask us anytime to see or delete yours: <a href={`mailto:${siteConfig.email}`} className="font-semibold text-royal underline">{siteConfig.email}</a>.
              </li>
            </ul>
          </div>
        </Container>
      </section>

      <section aria-labelledby="partner-faq-title" className="relative bg-ice-50 pb-28 pt-14 sm:pb-36 sm:pt-20">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Good to know" title={<span id="partner-faq-title">Partner FAQ</span>} />
          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-[1.75rem] bg-white ring-1 ring-inset ring-sky-200 open:shadow-[var(--shadow-card)]">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 font-display text-lg font-bold text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden="true" className="text-royal transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-ink-soft">
            <MailIcon className="size-5 text-royal" />
            Questions first? Email{" "}
            <a href={`mailto:${siteConfig.email}?subject=${encodeURIComponent("Partner question")}`} className="font-semibold text-royal underline underline-offset-4">
              {siteConfig.email}
            </a>
          </p>
        </Container>
      </section>
    </PageTransition>
  );
}
