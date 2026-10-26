import { useId, type Ref } from "react";
import type { ArtPalette } from "@/commerce/types";
import type { TextureId } from "@/content/textures";
import { Face, outline, type FaceMood } from "./Face";

/**
 * A squishy blob character drawn for each texture style. Used by the Squish Lab
 * demo — an illustration, never presented as a photo of a real product.
 * `bodyRef`/`shadowRef` let the demo animate the body without re-rendering.
 */
export function TextureBlob({
  texture,
  palette,
  mood = "happy",
  className,
  bodyRef,
  shadowRef,
  title,
}: {
  texture: TextureId;
  palette: ArtPalette;
  mood?: FaceMood;
  className?: string;
  bodyRef?: Ref<SVGGElement>;
  shadowRef?: Ref<SVGEllipseElement>;
  title?: string;
}) {
  const id = useId();
  const fill = `${id}-fill`;
  const jelly = texture === "jelly";

  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <radialGradient id={fill} cx="35%" cy="28%" r="85%">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="48%" stopColor={palette.base} />
          <stop offset="100%" stopColor={palette.shade} />
        </radialGradient>
      </defs>

      <ellipse
        ref={shadowRef}
        cx="120"
        cy="222"
        rx="74"
        ry="9"
        fill={outline}
        opacity="0.14"
        style={{ transformOrigin: "120px 222px", transformBox: "view-box" }}
      />

      {/* Squashes from the bottom center so it looks pressed onto the table. */}
      <g ref={bodyRef} style={{ transformOrigin: "120px 216px", transformBox: "view-box", willChange: "transform" }}>
        {texture === "buttery" && (
          // a little melty pat on top
          <path d="M92 52 C 92 40 148 40 148 52 L 148 60 C 148 66 92 66 92 60 Z" fill="#fff6d6" stroke={outline} strokeWidth="5" strokeLinejoin="round" />
        )}
        <path
          d={BODY[texture]}
          fill={`url(#${fill})`}
          fillOpacity={jelly ? 0.86 : 1}
          stroke={outline}
          strokeWidth="5"
          strokeLinejoin="round"
        />
        {/* gloss */}
        <path d="M70 92 C 78 76 94 68 110 66" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity={jelly ? 0.95 : 0.7} />
        {jelly && <ellipse cx="160" cy="170" rx="14" ry="22" fill="#fff" opacity="0.18" />}
        {texture === "crunchy" &&
          SPRINKLES.map(([x, y, r, c], i) => (
            <rect key={i} x={x} y={y} width="12" height="5" rx="2.5" transform={`rotate(${r} ${x + 6} ${y + 2.5})`} fill={c} stroke={outline} strokeWidth="1.5" />
          ))}
        {texture === "slow-rise" &&
          PORES.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={palette.shade} opacity="0.22" />)}
        {texture === "soft" && <path d="M58 118 C 48 96 72 78 90 88" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.5" />}
        <Face cx={120} cy={152} scale={1.15} mood={mood} />
      </g>
    </svg>
  );
}

const BODY: Record<TextureId, string> = {
  // cloud: puffy bumps on top
  soft: "M40 186 C 22 186 18 150 40 142 C 30 112 62 92 84 104 C 92 72 140 66 152 98 C 176 84 210 106 198 138 C 222 146 218 186 196 186 Q 120 214 40 186 Z",
  // bun / marshmallow
  "slow-rise": "M36 190 C 24 120 60 72 120 72 C 180 72 216 120 204 190 Q 120 222 36 190 Z",
  // jelly drop
  jelly: "M120 46 C 150 80 206 118 204 168 C 202 204 160 216 120 216 C 80 216 38 204 36 168 C 34 118 90 80 120 46 Z",
  // round bun with sprinkles
  crunchy: "M32 180 C 26 112 70 70 120 70 C 170 70 214 112 208 180 C 206 204 34 204 32 180 Z",
  // soft cube of butter-cake
  buttery: "M44 92 Q 44 64 72 64 L 168 64 Q 196 64 196 92 L 200 186 Q 200 210 176 210 L 64 210 Q 40 210 40 186 Z",
};

const SPRINKLES: [number, number, number, string][] = [
  [70, 96, -30, "#ff7aa8"],
  [104, 84, 20, "#4ea8ff"],
  [140, 90, -10, "#7fe08a"],
  [168, 112, 40, "#a68aff"],
  [58, 128, 60, "#4ea8ff"],
  [176, 146, -40, "#ff7aa8"],
  [90, 112, 80, "#ffffff"],
];

const PORES: [number, number, number][] = [
  [72, 110, 3],
  [96, 96, 2.5],
  [150, 98, 3],
  [174, 128, 2.5],
  [62, 160, 2.5],
  [182, 170, 3],
  [132, 196, 2.5],
  [88, 192, 3],
];
