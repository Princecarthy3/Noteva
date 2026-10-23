"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
let fallbackTheme: ThemePreference = "system";

function currentTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const storedTheme = window.localStorage.getItem("studystation-theme");
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") return storedTheme;
  } catch {
    return fallbackTheme;
  }
  return fallbackTheme;
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("studystation-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("studystation-theme-change", onChange);
  };
}

function saveTheme(theme: ThemePreference) {
  fallbackTheme = theme;
  try {
    window.localStorage.setItem("studystation-theme", theme);
  } catch {
    fallbackTheme = theme;
  }
  window.dispatchEvent(new Event("studystation-theme-change"));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, (): ThemePreference => "system");

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      root.dataset.theme = theme === "system" ? systemDark.matches ? "dark" : "light" : theme;
      root.style.colorScheme = theme === "system"
        ? systemDark.matches ? "dark" : "light"
        : theme;
    };
    applyTheme();
    systemDark.addEventListener("change", applyTheme);
    return () => systemDark.removeEventListener("change", applyTheme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme: saveTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}
