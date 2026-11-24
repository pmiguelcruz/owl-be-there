import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  newHomeWallpaper,
  rememberHomeWallpaper,
  wallpaperPaletteStyle,
} from '../src/lib/wallpaperPalette.ts';

afterEach(() => vi.unstubAllGlobals());

describe('homepage wallpaper', () => {
  it('uses another seed and gradient even if the random source repeats', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (words: Uint32Array) => words.fill(0),
    });
    const first = newHomeWallpaper();
    rememberHomeWallpaper(first);
    const next = newHomeWallpaper();
    expect(next.seed).not.toEqual(first.seed);
    expect(next.gradient).not.toEqual(first.gradient);
    expect(next.kind).toBeUndefined();
    expect(wallpaperPaletteStyle(next)).toMatchObject({
      '--event-base': expect.stringMatching(/^#[a-f0-9]{6}$/),
      '--event-highlight': expect.stringMatching(/^#[a-f0-9]{6}$/),
    });
    vi.stubGlobal('crypto', {
      getRandomValues: (words: Uint32Array) => words.fill(1),
    });
    expect(newHomeWallpaper().wild).toBeUndefined();
  });
});
