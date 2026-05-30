"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Sun, Moon, Monitor, Check, Palette, Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccentColor, ACCENT_COLORS } from "@/components/color-theme-provider";

const themes = [
  { value: "light",  label: "Light",  icon: Sun,     description: "Clean white interface" },
  { value: "dark",   label: "Dark",   icon: Moon,    description: "Easy on the eyes" },
  { value: "system", label: "System", icon: Monitor, description: "Follows device setting" },
] as const;

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function AdminSettingsPage() {
  const { theme, setTheme } = useTheme();
  const { accent, customHex, setAccent, setCustomHex } = useAccentColor();
  const [mounted, setMounted] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage global app appearance</p>
      </div>

      {/* Light / Dark / System */}
      <SectionCard icon={Sun} title="Mode">
        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ value, label, icon: Icon, description }) => {
            const active = mounted && theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200",
                  active
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                    : "border-border/60 bg-background hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                {active && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </span>
                )}
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", active ? "bg-primary/15" : "bg-muted")}>
                  <Icon className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", active ? "text-primary" : "text-foreground")}>{label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Accent color */}
      <SectionCard icon={Palette} title="Accent Color">
        {/* Preset swatches */}
        <div className="grid grid-cols-4 gap-3">
          {ACCENT_COLORS.map(({ key, label, hue, chroma }) => {
            const active = mounted && accent === key;
            return (
              <button
                key={key}
                onClick={() => setAccent(key)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-all duration-200",
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/60 bg-background hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2 h-2 text-primary-foreground" />
                  </span>
                )}
                <div
                  className="w-8 h-8 rounded-lg shadow-sm"
                  style={{ background: `oklch(0.55 ${chroma} ${hue})` }}
                />
                <p className="text-xs font-medium text-foreground leading-none">{label}</p>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-xs text-muted-foreground">or pick custom</span>
          <div className="flex-1 h-px bg-border/60" />
        </div>

        {/* Custom color picker */}
        <button
          onClick={() => colorInputRef.current?.click()}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl border-2 p-3.5 transition-all duration-200",
            mounted && accent === "custom"
              ? "border-primary bg-primary/5"
              : "border-border/60 bg-background hover:border-primary/40 hover:bg-muted/40"
          )}
        >
          {/* Color preview circle */}
          <div
            className="w-9 h-9 rounded-xl shadow-sm border border-border/40 shrink-0 transition-all"
            style={{ background: mounted ? customHex : "#6366f1" }}
          />
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Custom Color</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{mounted ? customHex.toUpperCase() : "#6366F1"}</p>
          </div>
          <Pipette className="w-4 h-4 text-muted-foreground shrink-0" />
          {mounted && accent === "custom" && (
            <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 text-primary-foreground" />
            </span>
          )}
        </button>

        {/* Hidden native color input */}
        <input
          ref={colorInputRef}
          type="color"
          className="sr-only"
          value={mounted ? customHex : "#6366f1"}
          onChange={(e) => setCustomHex(e.target.value)}
        />

        <p className="text-xs text-muted-foreground">Changes apply instantly across the entire app.</p>
      </SectionCard>
    </div>
  );
}
