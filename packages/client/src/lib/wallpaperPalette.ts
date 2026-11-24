import {
  PATTERN_KINDS,
  PatternSpec,
  patternPalette,
  WALLPAPER_GRADIENTS,
  type Pattern,
} from '@owl/shared';
import type { CSSProperties } from 'react';
import { browserBacking, Store } from './storage.ts';

export function wallpaperPaletteStyle(pattern: Pattern): CSSProperties {
  const { base, ink, highlight, lettering } = patternPalette(pattern);
  return {
    '--event-base': base,
    '--event-ink': ink,
    '--event-highlight': highlight,
    '--event-lettering': lettering,
  } as CSSProperties;
}

const homeWallpaper = new Store(browserBacking('sessionStorage'));
const homeKey = 'owl.home-wallpaper';

export function newHomeWallpaper(): Pattern {
  const previous = homeWallpaper.read(homeKey, PatternSpec);
  const kinds = PATTERN_KINDS.filter((kind) => kind !== previous?.kind);
  const gradients = WALLPAPER_GRADIENTS.filter(
    (style) => style !== previous?.gradient
  );
  const words = crypto.getRandomValues(new Uint32Array(4));
  return {
    kind: kinds[words[0]! % kinds.length]!,
    gradient: gradients[words[1]! % gradients.length]!,
    seed: words[2]!,
    ...(words[3]! % 5 === 0 && { wild: true }),
  };
}

export function rememberHomeWallpaper(pattern: Pattern): void {
  homeWallpaper.write(homeKey, pattern);
}
