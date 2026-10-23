import { useId } from "react";
import type { ArtPalette, ProductArtKind } from "@/commerce/types";
import { Face, outline, type FaceMood } from "./Face";

type ArtProps = {
  palette: ArtPalette;
  className?: string;
  mood?: FaceMood;
  title?: string;
};

function svgA11y(title?: string) {
  return title
    ? ({ role: "img", "aria-label": title } as const)
    : ({ "aria-hidden": true } as const);
}

/* ------------------------------ Slushie cup ------------------------------ */
export function SlushieArt({ palette, className, mood = "happy", title }: ArtProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 200 240" className={className} {...svgA11y(title)}>
      <defs>
        <linearGradient id={`${id}-cup`} x1="0" x2="1">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="35%" stopColor={palette.base} />
          <stop offset="100%" stopColor={palette.shade} />
        </linearGradient>
        <linearGradient id={`${id}-ice`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor={palette.light} />
        </linearGradient>
        <clipPath id={`${id}-dome`}>
          <path d="M36 98 C 36 46 164 46 164 98 Z" />
        </clipPath>
      </defs>

      <ellipse cx="100" cy="230" rx="56" ry="7" fill={outline} opacity="0.12" />

      {/* straw */}
      <path d="M112 74 L 128 22 L 160 14" fill="none" stroke={outline} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M112 74 L 128 22 L 160 14" fill="none" stroke={palette.accent} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M112 74 L 128 22 L 160 14" fill="none" stroke={palette.base} strokeWidth="10" strokeDasharray="7 9" strokeLinejoin="round" />

      {/* dome with slush inside */}
      <path d="M36 98 C 36 46 164 46 164 98 Z" fill="#fff" fillOpacity="0.6" />
      <g clipPath={`url(#${id}-dome)`}>
        <path
          d="M30 100 C 40 70 60 64 74 74 C 84 58 108 56 118 70 C 132 58 156 66 170 100 Z"
          fill={`url(#${id}-ice)`}
        />
        <circle cx="70" cy="84" r="4" fill="#fff" opacity="0.9" />
        <circle cx="132" cy="80" r="3" fill="#fff" opacity="0.9" />
        <circle cx="100" cy="72" r="2.5" fill="#fff" opacity="0.9" />
      </g>
      <path d="M36 98 C 36 46 164 46 164 98" fill="none" stroke={outline} strokeWidth="5" strokeLinejoin="round" />
      <path d="M58 70 C 66 60 78 56 88 55" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.9" />

      {/* cup */}
      <path
        d="M34 108 L 166 108 L 152 212 Q 150 224 137 224 L 63 224 Q 50 224 48 212 Z"
        fill={`url(#${id}-cup)`}
        stroke={outline}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* label band */}
      <path d="M40 150 L 160 150 L 156 182 L 44 182 Z" fill="#fff" opacity="0.28" />
      {/* gloss stripe */}
      <path d="M56 118 L 64 206" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity="0.55" />

      {/* lid rim */}
      <rect x="26" y="92" width="148" height="20" rx="10" fill="#fff" stroke={outline} strokeWidth="5" />
      <rect x="38" y="97" width="40" height="5" rx="2.5" fill={palette.light} />

      <Face cx={104} cy={160} scale={1} mood={mood} />
    </svg>
  );
}

/* ------------------------------- Jelly bear ------------------------------ */
export function JellyArt({ palette, className, mood = "happy", title }: ArtProps) {
  const id = useId();
  const shapes = (
    <>
      <circle cx="58" cy="50" r="22" />
      <circle cx="142" cy="50" r="22" />
      <ellipse cx="100" cy="158" rx="60" ry="56" />
      <ellipse cx="40" cy="146" rx="18" ry="26" transform="rotate(25 40 146)" />
      <ellipse cx="160" cy="146" rx="18" ry="26" transform="rotate(-25 160 146)" />
      <ellipse cx="66" cy="206" rx="26" ry="16" />
      <ellipse cx="134" cy="206" rx="26" ry="16" />
      <circle cx="100" cy="88" r="52" />
    </>
  );
  return (
    <svg viewBox="0 0 200 236" className={className} {...svgA11y(title)}>
      <defs>
        <radialGradient id={`${id}-jelly`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="50%" stopColor={palette.base} />
          <stop offset="100%" stopColor={palette.shade} />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="228" rx="70" ry="7" fill={outline} opacity="0.12" />
      {/* outline pass (thick stroke) then fill pass: gives one clean outer outline */}
      <g fill={outline} stroke={outline} strokeWidth="11">{shapes}</g>
      <g fill={`url(#${id}-jelly)`} opacity="0.97">{shapes}</g>

      {/* inner ear + belly (lighter, translucent jelly) */}
      <circle cx="58" cy="50" r="10" fill={palette.light} opacity="0.7" />
      <circle cx="142" cy="50" r="10" fill={palette.light} opacity="0.7" />
      <ellipse cx="100" cy="168" rx="34" ry="30" fill="#fff" opacity="0.28" />

      {/* trapped jelly bubbles */}
      <circle cx="74" cy="176" r="5" fill="#fff" opacity="0.55" />
      <circle cx="126" cy="190" r="3.5" fill="#fff" opacity="0.55" />
      <circle cx="142" cy="160" r="2.5" fill="#fff" opacity="0.55" />

      {/* gloss */}
      <ellipse cx="68" cy="66" rx="16" ry="9" transform="rotate(-35 68 66)" fill="#fff" opacity="0.85" />
      <circle cx="88" cy="50" r="4" fill="#fff" opacity="0.85" />
      <path d="M60 140 C 54 152 54 166 58 176" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.6" fill="none" />

      <Face cx={100} cy={94} scale={1} mood={mood} />
    </svg>
  );
}

/* ------------------------------ Crunchy bun ------------------------------ */
const SPRINKLES: Array<[number, number, number, string]> = [
  [58, 82, -30, "#ff7aa8"],
  [80, 64, 20, "#4ea8ff"],
  [104, 58, -10, "#ffd45e"],
  [128, 64, 35, "#5fe0c1"],
  [150, 80, -20, "#a68aff"],
  [70, 100, 60, "#5fe0c1"],
  [140, 102, -55, "#ff7aa8"],
  [116, 84, 75, "#4ea8ff"],
  [92, 86, -70, "#a68aff"],
  [164, 104, 15, "#ffd45e"],
  [46, 108, -5, "#4ea8ff"],
];

export function CrunchyArt({ palette, className, mood = "happy", title }: ArtProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 220 210" className={className} {...svgA11y(title)}>
      <defs>
        <radialGradient id={`${id}-bun`} cx="40%" cy="70%" r="75%">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="55%" stopColor={palette.base} />
          <stop offset="100%" stopColor={palette.shade} />
        </radialGradient>
        <linearGradient id={`${id}-icing`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={palette.light} />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="198" rx="82" ry="8" fill={outline} opacity="0.12" />

      {/* bun body */}
      <path
        d="M22 138 C 18 66 66 36 110 36 C 154 36 202 66 198 138 C 196 176 166 190 110 190 C 54 190 24 176 22 138 Z"
        fill={`url(#${id}-bun)`}
        stroke={outline}
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* crunchy texture dots */}
      <g fill={palette.shade} opacity="0.35">
        <circle cx="48" cy="160" r="2.4" />
        <circle cx="60" cy="172" r="2" />
        <circle cx="168" cy="164" r="2.4" />
        <circle cx="156" cy="176" r="2" />
        <circle cx="180" cy="148" r="1.8" />
        <circle cx="38" cy="146" r="1.8" />
      </g>

      {/* icing drip */}
      <path
        d="M34 108 C 30 66 70 42 110 42 C 150 42 190 66 186 108 C 182 120 172 112 168 120 C 164 132 150 130 148 118 C 146 108 134 108 132 118 C 128 136 108 136 106 120 C 104 108 92 110 88 120 C 84 132 68 130 68 118 C 68 108 56 108 52 116 C 46 126 36 122 34 108 Z"
        fill={`url(#${id}-icing)`}
        stroke={outline}
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* sprinkles */}
      {SPRINKLES.map(([x, y, r, c], i) => (
        <rect key={i} x={x - 6} y={y - 2.5} width="12" height="5" rx="2.5" fill={c} transform={`rotate(${r} ${x} ${y})`} />
      ))}

      {/* gloss */}
      <path d="M62 64 C 74 54 90 50 104 49" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.95" />

      <Face cx={110} cy={146} scale={0.95} mood={mood} />
    </svg>
  );
}

/* ----------------------------- Capsule toy ------------------------------ */
export function CapsuleArt({ palette, className, mood = "happy", title }: ArtProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 200 230" className={className} {...svgA11y(title)}>
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="45%" stopColor={palette.base} />
          <stop offset="100%" stopColor={palette.shade} />
        </linearGradient>
        <clipPath id={`${id}-top`}>
          <path d="M20 118 A 80 80 0 0 1 180 118 Z" />
        </clipPath>
      </defs>

      <ellipse cx="100" cy="220" rx="64" ry="7" fill={outline} opacity="0.12" />

      {/* clear top dome */}
      <path d="M20 118 A 80 80 0 0 1 180 118 Z" fill="#eaf6ff" />

      {/* tiny friend inside the dome */}
      <g clipPath={`url(#${id}-top)`}>
        <path d="M72 70 L 78 48 L 92 62 Z" fill={palette.base} stroke={outline} strokeWidth="4" strokeLinejoin="round" />
        <path d="M128 70 L 122 48 L 108 62 Z" fill={palette.base} stroke={outline} strokeWidth="4" strokeLinejoin="round" />
        <path
          d="M100 56 C 130 56 146 80 146 108 L 146 130 L 54 130 L 54 108 C 54 80 70 56 100 56 Z"
          fill={palette.base}
          stroke={outline}
          strokeWidth="4.5"
        />
        <ellipse cx="80" cy="76" rx="9" ry="5" transform="rotate(-30 80 76)" fill="#fff" opacity="0.7" />
        <Face cx={100} cy={92} scale={0.75} mood={mood} />
      </g>

      {/* glass shine over the dome */}
      <path d="M20 118 A 80 80 0 0 1 180 118 Z" fill="#fff" opacity="0.18" />
      <path d="M44 84 C 54 62 72 48 92 44" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M20 118 A 80 80 0 0 1 180 118" fill="none" stroke={outline} strokeWidth="5" />

      {/* solid bottom half */}
      <path d="M20 122 A 80 80 0 0 0 180 122 Z" fill={`url(#${id}-shell)`} stroke={outline} strokeWidth="5" strokeLinejoin="round" />
      <path d="M44 150 C 54 172 74 186 96 190" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.5" />

      {/* seam band */}
      <rect x="14" y="112" width="172" height="16" rx="8" fill="#fff" stroke={outline} strokeWidth="5" />

      {/* star sticker */}
      <path
        d="M140 150 l5.5 11 12 1.8 -8.7 8.4 2 12 -10.8 -5.7 -10.8 5.7 2 -12 -8.7 -8.4 12 -1.8 z"
        fill={palette.accent}
        stroke={outline}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------ Dispatcher ------------------------------ */
export function ProductArt({ kind, ...props }: ArtProps & { kind: ProductArtKind }) {
  switch (kind) {
    case "slushie":
      return <SlushieArt {...props} />;
    case "jelly":
      return <JellyArt {...props} />;
    case "crunchy":
      return <CrunchyArt {...props} />;
    case "capsule":
      return <CapsuleArt {...props} />;
  }
}
