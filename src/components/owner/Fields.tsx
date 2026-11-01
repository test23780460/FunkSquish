import type { ReactNode } from "react";
import { input, label } from "./OwnerUi";
import { cn } from "@/lib/cn";

/** Small labeled form fields for owner forms (server-rendered, no client JS). */

export function Text({ name, title, value, hint, className, ...rest }: { name: string; title: string; value?: string | number | null; hint?: ReactNode; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "title" | "value" | "defaultValue">) {
  return (
    <label className={cn(label, className)}>
      {title}
      <input name={name} defaultValue={value ?? ""} className={input} {...rest} />
      {hint && <span className="text-xs font-normal text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Area({ name, title, value, hint, rows = 3, maxLength, className }: { name: string; title: string; value?: string | null; hint?: ReactNode; rows?: number; maxLength?: number; className?: string }) {
  return (
    <label className={cn(label, className)}>
      {title}
      <textarea name={name} defaultValue={value ?? ""} rows={rows} maxLength={maxLength} className={cn(input, "min-h-20")} />
      {hint && <span className="text-xs font-normal text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Check({ name, title, checked, hint }: { name: string; title: ReactNode; checked?: boolean; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-ink">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 size-5 shrink-0 accent-[var(--color-royal)]" />
      <span>
        <span className="font-semibold">{title}</span>
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
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
      {hint && <span className="text-xs font-normal text-ink-soft">{hint}</span>}
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
