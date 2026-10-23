import { ViewTransition, type ReactNode } from "react";

/**
 * Wrap each page's content so route changes softly fade/rise in.
 * Uses the browser View Transitions API via React; browsers without support
 * simply swap pages instantly. Reduced-motion users get no animation (globals.css).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-fade" exit="page-fade" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
