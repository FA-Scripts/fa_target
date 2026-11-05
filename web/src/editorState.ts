import type { Theme } from "./types";
import { palettes } from "./theme";
export const sectionFields: Record<string, (keyof Theme)[]> = {
  Colors: ["accent", "surface", "text", "mutedText", "categoryColors"],
  Shape: [
    "opacity",
    "radius",
    "blur",
    "indicator",
    "indicatorStyle",
    "indicatorSize",
  ],
  Layout: ["scale", "width", "position", "font"],
  Behavior: [
    "animations",
    "highlight",
    "cursorHint",
    "fade",
    "sound",
    "soundVolume",
  ],
  Accessibility: ["highContrast", "textSize", "colorVision"],
};
export const sectionNames = Object.keys(sectionFields);
export function themeKey(theme: Theme) {
  return JSON.stringify({
    ...theme,
    accent: theme.accent.toLowerCase(),
    surface: theme.surface.toLowerCase(),
    text: theme.text.toLowerCase(),
    mutedText: theme.mutedText.toLowerCase(),
    categoryColors: Object.entries(theme.categoryColors)
      .map(([key, color]) => [key, color.toLowerCase()])
      .sort(([a], [b]) => a.localeCompare(b)),
  });
}

export function activePalette(theme: Theme) {
  return Object.entries(palettes).find(([, colors]) =>
    (["accent", "surface", "text", "mutedText"] as const).every(
      (key) => colors[key]?.toLowerCase() === theme[key].toLowerCase(),
    ),
  )?.[0];
}
export function sectionDefaults(
  section: string,
  defaults: Theme,
  can: (key: keyof Theme) => boolean,
): Partial<Theme> {
  const values: Partial<Theme> = {};
  for (const key of sectionFields[section])
    if (can(key)) Object.assign(values, { [key]: defaults[key] });
  return values;
}
