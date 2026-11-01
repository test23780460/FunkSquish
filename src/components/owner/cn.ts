/**
 * className joiner for the owner dashboard where the LAST class wins when two
 * classes set the same thing (e.g. `cn(secondary, small)` really makes a
 * small button, `cn(input, "w-28")` really narrows the field). Plain
 * `@/lib/cn` only joins strings, so which class wins depends on Tailwind's CSS
 * order instead. Only the utility families the dashboard overrides are known
 * here; anything else is kept as is. No dependency.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  const out: (string | null)[] = [];
  const seen = new Map<string, number>();
  for (const c of classes.filter(Boolean).join(" ").split(/\s+/)) {
    if (!c) continue;
    const key = conflictKey(c);
    if (key) {
      const prev = seen.get(key);
      if (prev !== undefined) out[prev] = null;
      seen.set(key, out.length);
    }
    out.push(c);
  }
  return out.filter(Boolean).join(" ");
}

const GROUPS: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/^text-(xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(rem|px|em)\])$/, "font-size"],
  [/^text-(left|center|right|justify|start|end)$/, "text-align"],
  [/^text-/, "text-color"],
  [/^ring(-\d+)?$/, "ring-width"],
  [/^ring-(inset|offset)/, (m) => `ring-${m[1]}`],
  [/^ring-/, "ring-color"],
  [/^bg-/, "bg"],
  [/^shadow(-|$)/, "shadow"],
  [/^rounded(?:-(tl|tr|bl|br|t|b|l|r))?(?:-|$)/, (m) => `rounded${m[1] ? `-${m[1]}` : ""}`],
  [/^(min-h|max-h|min-w|max-w|size|h|w)-/, (m) => m[1]],
  [/^(px|py|pt|pb|pl|pr|p|mx|my|mt|mb|ml|mr|m)-/, (m) => m[1]],
  [/^(gap-x|gap-y|gap)-/, (m) => m[1]],
  [/^font-(thin|light|normal|medium|semibold|bold|extrabold|black)$/, "font-weight"],
  [/^font-/, "font-family"],
  [/^leading-/, "leading"],
  [/^tracking-/, "tracking"],
  [/^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents)$/, "display"],
];

/** Variant prefix + utility family, or null when this class isn't in a known family. */
export function conflictKey(cls: string): string | null {
  let depth = 0;
  let split = -1;
  for (let i = 0; i < cls.length; i++) {
    const ch = cls[i];
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === ":" && depth === 0) split = i;
  }
  const variant = cls.slice(0, split + 1);
  const utility = cls.slice(split + 1).replace(/^!/, "").replace(/^-/, "");
  for (const [re, group] of GROUPS) {
    const m = utility.match(re);
    if (m) return variant + (typeof group === "string" ? group : group(m));
  }
  return null;
}
