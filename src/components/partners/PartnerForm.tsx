"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { getPartnerFormToken, submitPartnerApplication } from "@/app/actions/partners";
import type { PartnerSubmitState } from "@/lib/partners/submit";
import { CONSENT_TEXT, FIELD_GROUPS, PARTNER_TYPES, fieldsFor, type FieldDef, type PartnerType } from "@/lib/partners/schema";
import { validatePartnerEntries } from "@/lib/partners/validate";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon, MailIcon } from "@/components/icons/Icons";
import { Mascot } from "@/components/illustrations/Mascot";
import { trackEvent } from "@/components/analytics/track";
import { cn } from "@/lib/cn";

const inputBase =
  "mt-1.5 w-full rounded-2xl bg-white px-4 text-base text-ink ring-2 ring-inset placeholder:text-ink-soft/70 focus:outline-none focus:ring-royal";

export function PartnerForm({ email }: { email: string }) {
  const [type, setType] = useState<PartnerType | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PartnerSubmitState>({ status: "idle" });
  const [token, setToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Ask the server for a signed form token once the page is open in a browser.
  useEffect(() => {
    let alive = true;
    getPartnerFormToken().then((t) => alive && setToken(t)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (result.status === "success") resultRef.current?.focus();
  }, [result.status]);

  const focusFirstError = (errs: Record<string, string>) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`) ?? formRef.current?.querySelector<HTMLElement>("[role=alert]");
    el?.focus();
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const check = validatePartnerEntries([...data.entries()].filter(([k]) => k !== "token" && k !== "fax_number"));
    if (!check.ok) {
      setErrors(check.errors);
      setResult({ status: "error", message: "Please check the highlighted fields." });
      requestAnimationFrame(() => focusFirstError(check.errors));
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const r = await submitPartnerApplication(data);
        setResult(r);
        if (r.status === "error" && r.errors) {
          setErrors(r.errors);
          requestAnimationFrame(() => focusFirstError(r.errors ?? {}));
        }
        if (r.status === "error" && /expired/.test(r.message)) setToken(await getPartnerFormToken());
        if (r.status === "success") trackEvent("partner-application", { type: String(data.get("type")) });
      } catch {
        setResult({ status: "error", message: `Something went wrong sending your application. Please try again, or email ${email}.` });
      }
    });
  };

  const interestOnly = type === "reseller";

  if (result.status === "success") {
    return (
      <div ref={resultRef} tabIndex={-1} role="status" className="rounded-[2.25rem] bg-white p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 focus:outline-none sm:p-10">
        <Mascot className="mx-auto w-28" mood="grin" wave />
        <h3 className="mt-4 font-display text-3xl font-bold text-ink">{interestOnly ? "Interest noted — thank you!" : "Application received — thank you!"}</h3>
        {result.reference && (
          <p className="mt-3 font-display text-lg text-ink">
            Your reference: <strong className="select-all rounded-lg bg-ice px-2 py-0.5">{result.reference}</strong>
          </p>
        )}
        {interestOnly ? (
          <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-ink-soft">
            We&apos;ve saved your details. <strong className="text-ink">This isn&apos;t a wholesale account or an order</strong> — we don&apos;t
            have a wholesale program yet. If one opens, we&apos;ll email you from {email}.
          </p>
        ) : (
          <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-ink-soft">
            This confirms we&apos;ve received your application — <strong className="text-ink">it isn&apos;t an approval</strong>. We read
            every application ourselves. If it&apos;s a fit, we&apos;ll reply from {email} to talk next steps.
          </p>
        )}
        <p className="mt-3 text-sm text-ink-soft">We never charge application fees and won&apos;t ask for payment to be considered.</p>
      </div>
    );
  }

  const fields = type ? fieldsFor(type) : [];
  const groups = FIELD_GROUPS.map((g) => ({ ...g, defs: g.fields.flatMap((n) => fields.filter((f) => f.name === n)) })).filter((g) => g.defs.length);
  const requiredCount = fields.filter((f) => f.required).length;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6" aria-describedby="partner-form-note">
      <input type="hidden" name="token" value={token ?? ""} />
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label>
          Fax number
          <input type="text" name="fax_number" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="rounded-[2rem] bg-white p-5 ring-1 ring-inset ring-sky-200 sm:p-6">
        <legend className="float-left w-full font-display text-xl font-bold text-ink">1. What kind of partner are you?</legend>
        <div className="clear-left grid gap-2.5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARTNER_TYPES.map((t) => (
            <label
              key={t.id}
              className={cn(
                "flex cursor-pointer flex-col rounded-2xl p-4 transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-royal",
                type === t.id ? "bg-ice ring-2 ring-inset ring-royal" : "bg-ice-50 ring-1 ring-inset ring-sky-200 hover:bg-ice",
              )}
            >
              <input type="radio" name="type" value={t.id} checked={type === t.id} onChange={() => setType(t.id)} className="sr-only" />
              <span className="flex items-center justify-between gap-2 font-display text-lg font-bold text-ink">
                {t.short}
                {type === t.id && <CheckIcon className="size-5 text-royal" />}
              </span>
              <span className="mt-1 text-sm leading-snug text-ink-soft">{t.blurb}</span>
            </label>
          ))}
        </div>
        {errors.type && <p role="alert" className="mt-3 text-sm font-semibold text-[#b8215a]">{errors.type}</p>}
      </fieldset>

      {type && (
        <>
          <p className="rounded-2xl bg-ice-50 px-4 py-3 text-[0.95rem] leading-relaxed text-ink ring-1 ring-inset ring-sky-200">
            <strong>
              {fields.length} questions, only {requiredCount} required
            </strong>{" "}
            (marked <span className="text-[#b8215a]">*</span>). Rough answers are fine — skip anything you&apos;d rather discuss by email.
          </p>
          {groups.map((g, gi) => (
            <fieldset key={g.title} className="rounded-[2rem] bg-white p-5 ring-1 ring-inset ring-sky-200 sm:p-6">
              <legend className="float-left w-full font-display text-xl font-bold text-ink">
                {gi + 2}. {g.title}
              </legend>
              {g.intro && <p className="clear-left pt-1.5 text-[0.95rem] leading-relaxed text-ink-soft">{g.intro}</p>}
              <div className="clear-left grid gap-4 pt-4 sm:grid-cols-2">
                {g.defs.map((f) => (
                  <Field key={f.name} def={f} error={errors[f.name]} />
                ))}
              </div>
            </fieldset>
          ))}

          <div className="rounded-[2rem] bg-ice-50 p-5 ring-1 ring-inset ring-sky-200 sm:p-6">
            <label className="flex items-start gap-3 text-ink">
              <input
                type="checkbox"
                name="consent"
                value="yes"
                aria-invalid={!!errors.consent}
                aria-describedby={errors.consent ? "consent-error" : undefined}
                className="mt-1 size-5 shrink-0 accent-[var(--color-royal)]"
              />
              <span>{CONSENT_TEXT}</span>
            </label>
            {errors.consent && (
              <p id="consent-error" role="alert" className="mt-2 text-sm font-semibold text-[#b8215a]">
                {errors.consent}
              </p>
            )}
            <p id="partner-form-note" className="mt-3 text-sm leading-relaxed text-ink-soft">
              Please don&apos;t attach files or send samples yet — links are perfect. See the{" "}
              <a href="#partner-privacy" className="font-semibold text-royal underline underline-offset-4">privacy notice</a> and our{" "}
              <Link href="/privacy" className="font-semibold text-royal underline underline-offset-4">privacy policy</Link>.
            </p>
          </div>

          {result.status === "error" && (
            <p role="alert" className="rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink">
              {result.message}
            </p>
          )}
          {result.status === "closed" && (
            <p role="alert" className="rounded-2xl bg-lemon-soft px-4 py-3 font-semibold text-ink">
              Applications just closed. Please email {email} instead.
            </p>
          )}

          <button type="submit" disabled={pending || !token} className={buttonClasses({ size: "lg", className: "w-full disabled:cursor-wait disabled:opacity-60 sm:w-auto" })}>
            {pending ? "Sending…" : !token ? "Getting the form ready…" : interestOnly ? "Register my interest" : "Send application"}
          </button>
        </>
      )}
    </form>
  );
}

function Field({ def, error }: { def: FieldDef; error?: string }) {
  const id = `pf-${def.name}`;
  const describedBy = [def.hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const ring = error ? "ring-[#d62f6d]" : "ring-sky-200";
  const wide = def.kind === "textarea" || def.kind === "checkboxes" || def.name === "website" || (def.kind === "select" && def.label.length > 40);
  const marker = def.required ? <span className="text-[#b8215a]" aria-hidden="true"> *</span> : <span className="font-normal text-ink-soft"> (optional)</span>;

  return (
    <div className={cn(wide && "sm:col-span-2")}>
      {def.kind === "checkboxes" ? (
        <fieldset aria-describedby={describedBy}>
          <legend className="font-display font-semibold text-ink">
            {def.label}
            {marker}
          </legend>
          {def.options?.length === 1 ? (
            <label
              className={cn(
                "mt-2 flex cursor-pointer items-start gap-3 rounded-2xl bg-lemon-soft p-4 text-ink ring-inset has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-royal",
                error ? "ring-2 ring-[#d62f6d]" : "ring-1 ring-lemon",
              )}
            >
              <input type="checkbox" name={def.name} value={def.options[0]} aria-invalid={!!error} className="mt-1 size-5 shrink-0 accent-[var(--color-royal)]" />
              <span className="leading-relaxed">{def.options[0]}</span>
            </label>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {def.options?.map((o) => (
                <label
                  key={o}
                  className={cn(
                    "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-ice-50 px-3.5 py-1.5 text-sm font-semibold text-ink ring-1 ring-inset has-[:checked]:bg-ice has-[:checked]:ring-2 has-[:checked]:ring-royal has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-royal",
                    error ? "ring-[#d62f6d]" : "ring-sky-200",
                  )}
                >
                  <input type="checkbox" name={def.name} value={o} aria-invalid={!!error} className="size-4 shrink-0 accent-[var(--color-royal)]" />
                  {o}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ) : (
        <>
          <label htmlFor={id} className="font-display font-semibold text-ink">
            {def.label}
            {marker}
          </label>
          {def.kind === "textarea" ? (
            <textarea id={id} name={def.name} rows={4} maxLength={def.max} required={def.required} aria-invalid={!!error} aria-describedby={describedBy} placeholder={def.placeholder} className={cn(inputBase, ring, "py-3")} />
          ) : def.kind === "select" ? (
            <select id={id} name={def.name} required={def.required} aria-invalid={!!error} aria-describedby={describedBy} defaultValue="" className={cn(inputBase, ring, "min-h-12")}>
              <option value="">Choose…</option>
              {def.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={id}
              name={def.name}
              type={def.kind === "email" ? "email" : def.kind === "url" ? "url" : "text"}
              inputMode={def.kind === "email" ? "email" : def.kind === "url" ? "url" : undefined}
              maxLength={def.max}
              required={def.required}
              autoComplete={def.autoComplete ?? "off"}
              placeholder={def.placeholder}
              aria-invalid={!!error}
              aria-describedby={describedBy}
              className={cn(inputBase, ring, "min-h-12")}
            />
          )}
        </>
      )}
      {def.hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-soft">
          {def.hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-semibold text-[#b8215a]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Shown instead of the form until storage, notifications and the review login are all set up. */
export function PartnerFormClosed({ email }: { email: string }) {
  return (
    <div className="rounded-[2.25rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:p-8">
      <p className="inline-flex rounded-full bg-lemon-soft px-3 py-1 font-display text-sm font-semibold text-ink ring-1 ring-inset ring-lemon">Online applications open soon</p>
      <h3 className="mt-4 font-display text-2xl font-bold text-ink sm:text-3xl">For now, email us directly</h3>
      <p className="mt-3 text-lg leading-relaxed text-ink-soft">
        Our online application isn&apos;t switched on yet. You&apos;re welcome to email us — please include your business name, website or
        catalog link, country, the kind of partnership, and a few product examples. No attachments or samples yet, please.
      </p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        {PARTNER_TYPES.map((t) => (
          <a
            key={t.id}
            href={`mailto:${email}?subject=${encodeURIComponent(`Partner inquiry: ${t.short}`)}`}
            className={buttonClasses({ variant: "secondary" })}
          >
            <MailIcon className="size-5" />
            {t.short}
          </a>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-soft">Each button opens an email to {email} with the right subject line.</p>
    </div>
  );
}
