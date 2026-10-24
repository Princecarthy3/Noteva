"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Forces the light theme for public marketing / auth surfaces so they
 * never inherit the workspace dark preference.
 */
export function ForceLightTheme({ children }: { children?: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    const previousScheme = root.style.colorScheme;

    root.dataset.theme = "light";
    root.style.colorScheme = "light";

    return () => {
      if (previousTheme) root.dataset.theme = previousTheme;
      else delete root.dataset.theme;
      root.style.colorScheme = previousScheme;
    };
  }, []);

  return children ? <>{children}</> : null;
}
