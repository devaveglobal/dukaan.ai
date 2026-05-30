"use client";

import { createContext, useContext, useEffect, useState } from "react";

export const ACCENT_COLORS = [
  { key: "violet",  label: "Violet",  hue: 260, chroma: 0.18 },
  { key: "blue",    label: "Blue",    hue: 220, chroma: 0.18 },
  { key: "cyan",    label: "Cyan",    hue: 195, chroma: 0.16 },
  { key: "green",   label: "Green",   hue: 145, chroma: 0.17 },
  { key: "orange",  label: "Orange",  hue: 35,  chroma: 0.19 },
  { key: "rose",    label: "Rose",    hue: 10,  chroma: 0.20 },
  { key: "pink",    label: "Pink",    hue: 330, chroma: 0.19 },
  { key: "yellow",  label: "Yellow",  hue: 80,  chroma: 0.18 },
] as const;

export type AccentKey = typeof ACCENT_COLORS[number]["key"] | "custom";

const LS_KEY = "ai-sales-accent";
const LS_CUSTOM = "ai-sales-accent-custom";
const DEFAULT: AccentKey = "violet";

interface ColorThemeCtx {
  accent: AccentKey;
  customHex: string;
  setAccent: (key: AccentKey) => void;
  setCustomHex: (hex: string) => void;
}

const Ctx = createContext<ColorThemeCtx>({
  accent: DEFAULT,
  customHex: "#6366f1",
  setAccent: () => {},
  setCustomHex: () => {},
});

export function useAccentColor() {
  return useContext(Ctx);
}

/** Convert a hex color to an approximate oklch hue (0-360) via HSL hue passthrough */
export function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return Math.round(h * 360);
}

function buildCSS(hue: number, chroma: number) {
  return `
    :root {
      --primary: oklch(0.55 ${chroma} ${hue});
      --primary-foreground: oklch(0.99 0 0);
      --ring: oklch(0.55 ${chroma} ${hue});
      --secondary: oklch(0.96 0.01 ${hue});
      --secondary-foreground: oklch(0.2 0.05 ${hue});
      --muted: oklch(0.96 0.01 ${hue});
      --muted-foreground: oklch(0.5 0.03 ${hue});
      --accent: oklch(0.96 0.01 ${hue});
      --accent-foreground: oklch(0.2 0.05 ${hue});
      --border: oklch(0.9 0.01 ${hue});
      --input: oklch(0.9 0.01 ${hue});
    }
    .dark {
      --primary: oklch(0.65 ${chroma + 0.02} ${hue});
      --primary-foreground: oklch(0.12 0.02 ${hue});
      --ring: oklch(0.65 ${chroma + 0.02} ${hue});
      --secondary: oklch(0.2 0.03 ${hue});
      --secondary-foreground: oklch(0.98 0.01 ${hue});
      --muted: oklch(0.2 0.03 ${hue});
      --muted-foreground: oklch(0.6 0.02 ${hue});
      --accent: oklch(0.2 0.03 ${hue});
      --accent-foreground: oklch(0.98 0.01 ${hue});
      --border: oklch(0.25 0.02 ${hue});
      --input: oklch(0.25 0.02 ${hue});
    }
  `;
}

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentKey>(DEFAULT);
  const [customHex, setCustomHexState] = useState("#6366f1");

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY) as AccentKey | null;
    const storedHex = localStorage.getItem(LS_CUSTOM);
    if (storedHex) setCustomHexState(storedHex);
    if (stored && (ACCENT_COLORS.find((c) => c.key === stored) || stored === "custom")) {
      setAccentState(stored);
    }
  }, []);

  const setAccent = (key: AccentKey) => {
    setAccentState(key);
    localStorage.setItem(LS_KEY, key);
  };

  const setCustomHex = (hex: string) => {
    setCustomHexState(hex);
    localStorage.setItem(LS_CUSTOM, hex);
    setAccent("custom");
  };

  let hue: number, chroma: number;
  if (accent === "custom") {
    hue = hexToHue(customHex);
    chroma = 0.18;
  } else {
    const color = ACCENT_COLORS.find((c) => c.key === accent) ?? ACCENT_COLORS[0];
    hue = color.hue;
    chroma = color.chroma;
  }

  return (
    <Ctx.Provider value={{ accent, customHex, setAccent, setCustomHex }}>
      <style dangerouslySetInnerHTML={{ __html: buildCSS(hue, chroma) }} />
      {children}
    </Ctx.Provider>
  );
}
