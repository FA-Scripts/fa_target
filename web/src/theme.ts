import type { CSSProperties } from "react";
import type { FontDefinition, Theme } from "./types";

export const presets = ["precision", "minimal", "glass", "classic"];
export const presetLabels: Record<string, string> = {
  precision: "Precision",
  minimal: "Minimal",
  glass: "Glass",
  classic: "Legacy",
};
export const modeLabels: Record<string, string> = {
  focus: "Focus",
  classic: "Cursor",
  dui: "World",
};
export const ranges = {
  opacity: [0.45, 1, 0.01],
  radius: [0, 24, 1],
  scale: [0.75, 1.35, 0.01],
  blur: [0, 20, 1],
  width: [220, 420, 1],
  textSize: [12, 20, 1],
  indicatorSize: [10, 24, 1],
  soundVolume: [0, 1, 0.01],
} as const;
export const fallbackTheme: Theme = {
  preset: "precision",
  accent: "#7c5cff",
  surface: "#111217",
  text: "#f7f7fb",
  mutedText: "#adb0bf",
  opacity: 0.92,
  radius: 10,
  scale: 1,
  position: "center",
  font: "montserrat",
  animations: true,
  indicator: true,
  highlight: true,
  blur: 12,
  width: 280,
  textSize: 13,
  indicatorSize: 13,
  indicatorStyle: "ring",
  cursorHint: "first",
  highContrast: false,
  colorVision: "normal",
  fade: false,
  sound: false,
  soundVolume: 0.25,
  categoryColors: {},
};
export const presetThemes: Record<string, Partial<Theme>> = {
  precision: {
    surface: "#111217",
    text: "#f7f7fb",
    mutedText: "#adb0bf",
    opacity: 0.92,
    radius: 10,
    scale: 1,
  },
  minimal: {
    surface: "#0c0d10",
    text: "#ffffff",
    mutedText: "#bfc2cb",
    opacity: 0.88,
    radius: 5,
    scale: 1,
  },
  glass: {
    surface: "#171923",
    text: "#ffffff",
    mutedText: "#d0d3df",
    opacity: 0.78,
    radius: 16,
    blur: 12,
    scale: 1,
  },
  classic: {
    surface: "#090a0d",
    text: "#ffffff",
    mutedText: "#c7c9d1",
    opacity: 0.9,
    radius: 2,
    scale: 1,
  },
};
export const fallbackFonts: FontDefinition[] = [
  {
    id: "montserrat",
    label: "Montserrat",
    family: "Montserrat",
    file: "Montserrat-Variable.woff2",
    weight: "100 900",
  },
  { id: "system", label: "System", family: "Segoe UI" },
  { id: "condensed", label: "Condensed", family: "Arial Narrow" },
];
export const palettes: Record<string, Partial<Theme>> = {
  Violet: {
    accent: "#9b85ff",
    surface: "#111217",
    text: "#ffffff",
    mutedText: "#b8bac7",
  },
  Ice: {
    accent: "#77d9ef",
    surface: "#0d171e",
    text: "#f5fcff",
    mutedText: "#adc6d2",
  },
  Amber: {
    accent: "#f5bd64",
    surface: "#19140e",
    text: "#fffaf2",
    mutedText: "#c9bdab",
  },
  Neutral: {
    accent: "#e3e5eb",
    surface: "#141519",
    text: "#ffffff",
    mutedText: "#babdc7",
  },
};
const visions = {
  normal: "",
  protanopia: "#63c9ed",
  deuteranopia: "#79c6ff",
  tritanopia: "#ffae92",
};
export function hexToRgb(value: string) {
  const parsed = Number.parseInt(value.slice(1), 16);
  return `${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}`;
}
export function normalizeTheme(
  input: unknown,
  fallback = fallbackTheme,
  fonts = fallbackFonts,
): Theme {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Theme must be an object.");
  const data = input as Record<string, unknown>;
  const next = { ...fallback, categoryColors: { ...fallback.categoryColors } };
  for (const key of ["accent", "surface", "text", "mutedText"] as const) {
    if (typeof data[key] === "string" && /^#[0-9a-f]{6}$/i.test(data[key]))
      next[key] = data[key];
  }
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    if (typeof data[key] === "number" && Number.isFinite(data[key])) {
      const [min, max, step] = ranges[key];
      next[key] =
        Math.round(Math.min(max, Math.max(min, data[key])) / step) * step;
    }
  }
  for (const key of [
    "animations",
    "indicator",
    "highlight",
    "highContrast",
    "fade",
    "sound",
  ] as const) {
    if (typeof data[key] === "boolean") next[key] = data[key];
  }
  const preset = data.preset === "compact" ? "minimal" : data.preset;
  if (typeof preset === "string" && presets.includes(preset))
    next.preset = preset;
  const font = data.font === "inter" ? "montserrat" : data.font;
  if (typeof font === "string" && fonts.some((f) => f.id === font))
    next.font = font;
  if (["left", "center", "right"].includes(String(data.position)))
    next.position = data.position as Theme["position"];
  if (["ring", "dot", "crosshair"].includes(String(data.indicatorStyle)))
    next.indicatorStyle = data.indicatorStyle as Theme["indicatorStyle"];
  if (["always", "first", "never"].includes(String(data.cursorHint)))
    next.cursorHint = data.cursorHint as Theme["cursorHint"];
  if (
    ["normal", "protanopia", "deuteranopia", "tritanopia"].includes(
      String(data.colorVision),
    )
  )
    next.colorVision = data.colorVision as Theme["colorVision"];
  if (
    data.categoryColors &&
    typeof data.categoryColors === "object" &&
    !Array.isArray(data.categoryColors)
  ) {
    next.categoryColors = Object.fromEntries(
      Object.entries(data.categoryColors)
        .filter(
          ([key, value]) =>
            /^[a-zA-Z0-9_-]{1,32}$/.test(key) &&
            typeof value === "string" &&
            /^#[0-9a-f]{6}$/i.test(value),
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .slice(0, 16),
    ) as Record<string, string>;
  }
  return next;
}
export function themeVariables(
  theme: Theme,
  fonts: FontDefinition[],
): CSSProperties {
  const accent = theme.highContrast
    ? "#ffe27a"
    : visions[theme.colorVision] || theme.accent;
  const surface = theme.highContrast ? "#090909" : theme.surface;
  const text = theme.highContrast ? "#ffffff" : theme.text;
  const muted = theme.highContrast ? "#e4e4e4" : theme.mutedText;
  return {
    "--accent": accent,
    "--accent-rgb": hexToRgb(accent),
    "--surface": surface,
    "--surface-rgb": hexToRgb(surface),
    "--surface-alpha": theme.highContrast ? 1 : theme.opacity,
    "--text": text,
    "--text-rgb": hexToRgb(text),
    "--muted": muted,
    "--muted-rgb": hexToRgb(muted),
    "--radius": `${theme.radius}px`,
    "--scale": theme.scale,
    "--font-ui": `"${fonts.find((f) => f.id === theme.font)?.family ?? "Montserrat"}", "Segoe UI", sans-serif`,
    "--blur": `${theme.highContrast ? 0 : theme.blur}px`,
    "--panel-width": `${theme.width}px`,
    "--world-width": `${(theme.width * 260) / 280}px`,
    "--minimal-width": `${(theme.width * 248) / 280}px`,
    "--world-minimal-width": `${(theme.width * 240) / 280}px`,
    "--text-size": `${theme.textSize}px`,
    "--indicator-size": `${theme.indicatorSize}px`,
  } as CSSProperties;
}
export function optionAccent(theme: Theme, accent?: string, category?: string) {
  if (theme.highContrast) return "#ffe27a";
  if (accent) return accent;
  return (
    visions[theme.colorVision] ||
    (category &&
      Object.hasOwn(theme.categoryColors, category) &&
      theme.categoryColors[category]) ||
    theme.accent
  );
}
