import type { ReactNode } from "react";
import { hint as hintCls, input, label } from "./OwnerUi";
import { cn } from "@/lib/cn";

/** Small labeled form fields for owner forms (server-rendered, no client JS). */

export function Text({ name, title, value, hint, className, ...rest }: { name: string; title: string; value?: string | number | null; hint?: ReactNode; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "title" | "value" | "defaultValue">) {
  return (
    <label className={cn(label, className)}>
      {title}
      <input name={name} defaultValue={value ?? ""} className={input} {...rest} />
      {hint && <span className={hintCls}>{hint}</span>}
    </label>
  );
}

export function Area({ name, title, value, hint, rows = 3, maxLength, className }: { name: string; title: string; value?: string | null; hint?: ReactNode; rows?: number; maxLength?: number; className?: string }) {
  return (
    <label className={cn(label, className)}>
      {title}
      <textarea name={name} defaultValue={value ?? ""} rows={rows} maxLength={maxLength} className={cn(input, "min-h-20")} />
      {hint && <span className={hintCls}>{hint}</span>}
    </label>
  );
}

export function Check({ name, title, checked, hint }: { name: string; title: ReactNode; checked?: boolean; hint?: ReactNode }) {
  return (
    <label className="-mx-2 flex cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 text-sm text-ink hover:bg-ice-50">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-[var(--color-royal)]" />
      <span className="min-w-0">
        <span className="font-semibold">{title}</span>
        {hint && <span className={cn(hintCls, "block")}>{hint}</span>}
      </span>
    </label>
  );
}

export function Select({ name, title, value, options, hint, className }: { name: string; title: string; value?: string | null; options: { value: string; label: string }[]; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn(label, className)}>
      {title}
      <select name={name} defaultValue={value ?? ""} className={input}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className={hintCls}>{hint}</span>}
    </label>
  );
}

/** Hidden id + revision every product form carries (the save is refused if the product changed since). */
export function Rev({ id, rev }: { id: string; rev: number }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="rev" value={rev} />
    </>
  );
}

/** A titled group of fields inside a form ("Description", "Size & weight"…). */
export function FieldGroup({ title, description, children, cols = 2, className }: { title: string; description?: ReactNode; children: ReactNode; cols?: 1 | 2 | 3; className?: string }) {
  return (
    <fieldset className={cn("min-w-0 border-t border-sky-100 pt-4 first:border-t-0 first:pt-0", className)}>
      <legend className="float-left mb-3 w-full">
        <span className="block font-display text-[0.95rem] font-bold text-ink">{title}</span>
        {description && <span className={cn(hintCls, "mt-0.5 block text-[0.8rem]")}>{description}</span>}
      </legend>
      <div className={cn("clear-both grid gap-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>{children}</div>
    </fieldset>
  );
}
