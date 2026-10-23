/**
 * Shared cartoon face used by every FunkSquish character so the whole
 * illustration family feels related. Coordinates are in the parent SVG space.
 */
export type FaceMood = "happy" | "grin" | "wink" | "sleepy";

const OUTLINE = "#13357a";

export function Face({
  cx,
  cy,
  scale = 1,
  mood = "happy",
  blink = true,
}: {
  cx: number;
  cy: number;
  scale?: number;
  mood?: FaceMood;
  blink?: boolean;
}) {
  const s = scale;
  const eyeDx = 22 * s;
  const eyeRx = 7.5 * s;
  const eyeRy = 9.5 * s;

  const blinkClass = blink ? "animate-blink [transform-box:fill-box] [transform-origin:center]" : undefined;

  return (
    <g aria-hidden="true">
      {/* cheeks */}
      <ellipse cx={cx - eyeDx - 9 * s} cy={cy + 15 * s} rx={9 * s} ry={5.5 * s} fill="#ff8fb8" opacity={0.75} />
      <ellipse cx={cx + eyeDx + 9 * s} cy={cy + 15 * s} rx={9 * s} ry={5.5 * s} fill="#ff8fb8" opacity={0.75} />

      {/* eyes */}
      {mood === "sleepy" ? (
        <>
          <path d={`M${cx - eyeDx - 7 * s} ${cy} q${7 * s} ${7 * s} ${14 * s} 0`} stroke={OUTLINE} strokeWidth={4 * s} strokeLinecap="round" fill="none" />
          <path d={`M${cx + eyeDx - 7 * s} ${cy} q${7 * s} ${7 * s} ${14 * s} 0`} stroke={OUTLINE} strokeWidth={4 * s} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <g className={blinkClass}>
            <ellipse cx={cx - eyeDx} cy={cy} rx={eyeRx} ry={eyeRy} fill={OUTLINE} />
            <circle cx={cx - eyeDx + 2.6 * s} cy={cy - 3.5 * s} r={2.8 * s} fill="#fff" />
            <circle cx={cx - eyeDx - 2.4 * s} cy={cy + 3.6 * s} r={1.4 * s} fill="#fff" />
          </g>
          {mood === "wink" ? (
            <path d={`M${cx + eyeDx - 8 * s} ${cy + 1 * s} q${8 * s} ${-8 * s} ${16 * s} 0`} stroke={OUTLINE} strokeWidth={4 * s} strokeLinecap="round" fill="none" />
          ) : (
            <g className={blinkClass}>
              <ellipse cx={cx + eyeDx} cy={cy} rx={eyeRx} ry={eyeRy} fill={OUTLINE} />
              <circle cx={cx + eyeDx + 2.6 * s} cy={cy - 3.5 * s} r={2.8 * s} fill="#fff" />
              <circle cx={cx + eyeDx - 2.4 * s} cy={cy + 3.6 * s} r={1.4 * s} fill="#fff" />
            </g>
          )}
        </>
      )}

      {/* mouth */}
      {mood === "grin" ? (
        <g>
          <path
            d={`M${cx - 11 * s} ${cy + 12 * s} Q${cx} ${cy + 30 * s} ${cx + 11 * s} ${cy + 12 * s} Z`}
            fill={OUTLINE}
            stroke={OUTLINE}
            strokeWidth={3 * s}
            strokeLinejoin="round"
          />
          <ellipse cx={cx} cy={cy + 21 * s} rx={5 * s} ry={3 * s} fill="#ff7aa8" />
        </g>
      ) : (
        <path
          d={`M${cx - 8 * s} ${cy + 13 * s} Q${cx} ${cy + 21 * s} ${cx + 8 * s} ${cy + 13 * s}`}
          stroke={OUTLINE}
          strokeWidth={4 * s}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );
}

export const outline = OUTLINE;
