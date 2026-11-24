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

const tabWallpaper = new Store(browserBacking('sessionStorage'));
const sharedWallpaper = new Store(browserBacking());
const homeKey = 'owl.home-wallpaper';

/** In a tab, only loading the homepage rolls new colors. Fresh tabs use the
 * most recent homepage look in this browser. */
export function siteWallpaper(rotate: boolean): WallpaperLook {
  const previous =
    tabWallpaper.read(homeKey, WallpaperLookSpec) ??
    sharedWallpaper.read(homeKey, WallpaperLookSpec);
  if (previous && !rotate) return previous;
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

export function rememberSiteWallpaper(
  look: WallpaperLook,
  home: boolean
): void {
  tabWallpaper.write(homeKey, look);
  if (home || !sharedWallpaper.read(homeKey, WallpaperLookSpec))
    sharedWallpaper.write(homeKey, look);
}
