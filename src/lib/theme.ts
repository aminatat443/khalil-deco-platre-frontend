import { useSyncExternalStore } from "react";

export type ThemeSetting = "light" | "dark";

const STORAGE_KEY = "kdp-admin-theme";
const listeners = new Set<() => void>();

function systemPreference(): ThemeSetting {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStored(): ThemeSetting | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

let current: ThemeSetting = readStored() ?? systemPreference();
let scoped = false;

function paint() {
  // Le thème sombre est réservé au tableau de bord : la classe n'est posée que
  // pendant son montage, le site public et les devis partagés restent clairs.
  document.documentElement.classList.toggle("dark", scoped && current === "dark");
  listeners.forEach((listener) => listener());
}

export function getTheme(): ThemeSetting {
  return current;
}

export function toggleTheme() {
  current = current === "dark" ? "light" : "dark";
  try {
    window.localStorage.setItem(STORAGE_KEY, current);
  } catch {
    /* stockage indisponible : le choix reste valable pour la session */
  }
  paint();
}

export function setThemeScope(active: boolean) {
  scoped = active;
  paint();
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): ThemeSetting {
  return useSyncExternalStore(subscribeTheme, getTheme, () => "light" as ThemeSetting);
}

/** Puce colorée (fond pâle + encre foncée) rendue lisible sur fond sombre :
   le fond devient une voile translucide et l'encre est éclaircie. */
export function adaptChip(tint: string, color: string, setting: ThemeSetting) {
  if (setting !== "dark") return { backgroundColor: tint, color };
  const rgb = (hex: string) => {
    const digits = hex.replace("#", "");
    const full = digits.length === 3 ? digits.split("").map((d) => d + d).join("") : digits;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const ink = rgb(color);
  if (ink.some((v) => Number.isNaN(v))) return { backgroundColor: tint, color };
  const lighten = (v: number) => Math.round(v + (246 - v) * 0.62);
  return {
    backgroundColor: `rgba(${ink.join(", ")}, 0.22)`,
    color: `rgb(${ink.map(lighten).join(", ")})`,
  };
}
