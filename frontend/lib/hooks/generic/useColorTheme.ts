'use client';

import { useCallback, useEffect, useState } from 'react';

export const COLOR_THEMES = [
  { id: 'oceano', name: 'Océano', preview: 'oklch(0.55 0.22 260)' },
  { id: 'esmeralda', name: 'Esmeralda', preview: 'oklch(0.55 0.20 155)' },
  { id: 'ambar', name: 'Ámbar', preview: 'oklch(0.62 0.16 65)' },
  { id: 'grafito', name: 'Grafito', preview: 'oklch(0.40 0.02 260)' },
  { id: 'violeta', name: 'Violeta', preview: 'oklch(0.55 0.20 290)' },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]['id'];

const STORAGE_KEY = 'color-theme';
const DEFAULT_THEME: ColorThemeId = 'oceano';

function applyTheme(themeId: ColorThemeId) {
  if (themeId === DEFAULT_THEME) {
    document.documentElement.removeAttribute('data-color-theme');
  } else {
    document.documentElement.setAttribute('data-color-theme', themeId);
  }
}

export function useColorTheme() {
  const [mounted, setMounted] = useState(false);
  const [colorTheme, setColorThemeState] = useState<ColorThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ColorThemeId | null;
    const validIds = COLOR_THEMES.map((t) => t.id) as readonly string[];
    const theme = stored && validIds.includes(stored) ? (stored as ColorThemeId) : DEFAULT_THEME;
    setColorThemeState(theme);
    applyTheme(theme);
    setMounted(true);
  }, []);

  const setColorTheme = useCallback((themeId: ColorThemeId) => {
    setColorThemeState(themeId);
    applyTheme(themeId);
    if (themeId === DEFAULT_THEME) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, themeId);
    }
  }, []);

  return { colorTheme, setColorTheme, mounted };
}
