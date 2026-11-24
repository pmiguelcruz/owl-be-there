import { patternPalette, type Pattern } from '@owl/shared';
import type { CSSProperties } from 'react';

export function wallpaperPaletteStyle(pattern: Pattern): CSSProperties {
  const { base, ink, highlight, lettering } = patternPalette(pattern);
  return {
    '--event-base': base,
    '--event-ink': ink,
    '--event-highlight': highlight,
    '--event-lettering': lettering,
  } as CSSProperties;
}
