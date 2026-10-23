import { useId } from "react";
import { Face, outline, type FaceMood } from "./Face";

/**
 * The FunkSquish blob — a glossy blue jelly-drop with a funky curl on top.
 */
export function Mascot({
  className,
  mood = "grin",
  wave = false,
  title,
  base = "#3d9bff",
  light = "#b4e0ff",
  shade = "#1f62d9",
}: {
  className?: string;
  mood?: FaceMood;
  wave?: boolean;
  title?: string;
  base?: string;
  light?: string;
  shade?: string;
}) {
  const id = useId();
  const body = `${id}-body`;

  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <radialGradient id={body} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor={light} />
          <stop offset="45%" stopColor={base} />
          <stop offset="100%" stopColor={shade} />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="120" cy="224" rx="72" ry="9" fill={outline} opacity="0.12" />

      {/* left arm */}
      <path
        d="M42 148 C 22 140 6 152 10 170 C 13 184 32 184 44 172"
        fill={base}
        stroke={outline}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* right arm (optionally waving) */}
      {wave ? (
        <g className="origin-[200px_134px] animate-wobble">
          <path
            d="M194 128 C 204 112 208 94 218 88 C 230 81 239 93 232 104 C 225 116 214 130 204 142"
            fill={base}
            stroke={outline}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="222" cy="94" rx="5" ry="3" transform="rotate(-40 222 94)" fill="#fff" opacity="0.6" />
        </g>
      ) : (
        <path
          d="M198 148 C 218 140 234 152 230 170 C 227 184 208 184 196 172"
          fill={base}
          stroke={outline}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* body */}
      <path
        d="M120 38 C 176 38 208 84 212 134 C 216 186 186 216 120 216 C 54 216 24 186 28 134 C 32 84 64 38 120 38 Z"
        fill={`url(#${body})`}
        stroke={outline}
        strokeWidth="5.5"
        strokeLinejoin="round"
      />

      {/* funky curl */}
      <path
        d="M120 40 C 114 24 120 10 134 10 C 146 10 150 24 140 28"
        fill="none"
        stroke={outline}
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* jelly bottom shine */}
      <path d="M58 186 C 80 204 160 204 182 186" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="6" strokeLinecap="round" />

      {/* glossy highlights */}
      <ellipse cx="78" cy="88" rx="24" ry="13" transform="rotate(-38 78 88)" fill="#fff" opacity="0.8" />
      <circle cx="106" cy="66" r="6" fill="#fff" opacity="0.85" />
      <circle cx="186" cy="120" r="4" fill="#fff" opacity="0.5" />

      <Face cx={120} cy={132} scale={1.25} mood={mood} />
    </svg>
  );
}
