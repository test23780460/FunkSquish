"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isOwnerArea } from "./SiteHeader";

/** The public footer isn't shown inside the private owner area (it has its own frame). */
export function HideInOwnerArea({ children }: { children: ReactNode }) {
  return isOwnerArea(usePathname()) ? null : <>{children}</>;
}
