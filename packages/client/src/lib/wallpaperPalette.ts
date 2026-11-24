import {
  WallpaperLookSpec,
  lookPalette,
  WALLPAPER_GRADIENTS,
  type WallpaperLook,
} from '@owl/shared';
import type { CSSProperties } from 'react';
import { browserBacking, Store } from './storage.ts';

export function wallpaperPaletteStyle(look: WallpaperLook): CSSProperties {
  const { base, ink, highlight, lettering } = lookPalette(look);
  return {
    '--event-base': base,
    '--event-ink': ink,
    '--event-highlight': highlight,
    '--event-lettering': lettering,
  } as CSSProperties;
}

const homeWallpaper = new Store(browserBacking('sessionStorage'));
const homeKey = 'owl.home-wallpaper';

export function newHomeWallpaper(): WallpaperLook {
  const previous = homeWallpaper.read(homeKey, WallpaperLookSpec);
  const gradients = WALLPAPER_GRADIENTS.filter(
    (style) => style !== previous?.gradient
  );
  const words = crypto.getRandomValues(new Uint32Array(3));
  const seed = words[1]!;
  return {
    gradient: gradients[words[0]! % gradients.length]!,
    seed: seed === previous?.seed ? (seed + 1) >>> 0 : seed,
    ...(words[2]! % 5 === 0 && { wild: true }),
  };
}

export function rememberHomeWallpaper(look: WallpaperLook): void {
  homeWallpaper.write(homeKey, look);
}
