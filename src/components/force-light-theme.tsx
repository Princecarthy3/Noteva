"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Locks public marketing / auth surfaces to light theme only.
 * Workspace theme preference must never affect these pages.
 */
export function ForceLightTheme({ children }: { children?: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    const previousScheme = root.style.colorScheme;

    root.dataset.theme = "light";
    root.style.colorScheme = "light";
    root.classList.add("public-surface");
    document.body?.classList.add("public-surface");

    return () => {
      root.classList.remove("public-surface");
      document.body?.classList.remove("public-surface");
      if (previousTheme) root.dataset.theme = previousTheme;
      else delete root.dataset.theme;
      root.style.colorScheme = previousScheme;
    };
  }, []);

  return children ? <>{children}</> : null;
}
