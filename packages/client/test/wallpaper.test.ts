import { drawPattern, wallpaperGradient } from '@owl/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { paintWallpaperMarks } from '../src/lib/wallpaperMarks.ts';
import {
  newHomeWallpaper,
  rememberHomeWallpaper,
  wallpaperPaletteStyle,
} from '../src/lib/wallpaperPalette.ts';

afterEach(() => vi.unstubAllGlobals());

function canvasWithContext() {
  vi.stubGlobal('window', { devicePixelRatio: 3 });
  vi.stubGlobal('Path2D', class {});
  const context = {
    resetTransform: vi.fn(),
    clearRect: vi.fn(),
    scale: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    restore: vi.fn(),
  };
  const getContext = vi.fn().mockReturnValue(context);
  const canvas = {
    width: 200,
    height: 200,
    getContext,
  } as unknown as HTMLCanvasElement;
  return { canvas, context, getContext };
}

describe('wallpaper marks', () => {
  it('keeps the repeat at half scale and grows individual silhouettes', () => {
    const { canvas, context } = canvasWithContext();
    const pattern = { kind: 'stars', seed: 109, gradient: 'radial' } as const;
    paintWallpaperMarks(
      canvas,
      drawPattern(pattern),
      wallpaperGradient(pattern),
      120,
      90
    );
    expect([canvas.width, canvas.height]).toEqual([240, 180]);
    expect(context.scale).toHaveBeenNthCalledWith(1, 1, 1);
    expect(context.rotate).toHaveBeenCalled();
    expect(context.fill).toHaveBeenCalled();
    const scales = context.scale.mock.calls.map(([size]) => size as number);
    expect(scales.some((size) => size < 0.8)).toBe(true);
    expect(scales.some((size) => size > 1.2 && size < 1.5)).toBe(true);
  });

  it('clips continuous lines at the repeat seam and draws outlined marks', () => {
    const { canvas, context } = canvasWithContext();
    vi.stubGlobal('window', {});
    for (const kind of ['lattice', 'stripes', 'honeycomb'] as const) {
      const pattern = { kind, seed: 109 } as const;
      paintWallpaperMarks(
        canvas,
        drawPattern(pattern),
        wallpaperGradient(pattern),
        100,
        80
      );
    }
    expect([canvas.width, canvas.height]).toEqual([100, 80]);
    expect(context.clip).toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalled();
    expect(context.fill).toHaveBeenCalled();
  });

  it('waits for a visible canvas and tolerates an unavailable context', () => {
    const { canvas, context, getContext } = canvasWithContext();
    const pattern = { kind: 'rings', seed: 0 } as const;
    const tile = drawPattern(pattern);
    const field = wallpaperGradient(pattern);
    paintWallpaperMarks(canvas, tile, field, 0, 100);
    paintWallpaperMarks(canvas, tile, field, 100, 0);
    expect(getContext).not.toHaveBeenCalled();
    getContext.mockReturnValue(null);
    paintWallpaperMarks(canvas, tile, field, 100, 100);
    expect(getContext).toHaveBeenCalledOnce();
    expect(context.resetTransform).not.toHaveBeenCalled();
  });
});

describe('homepage wallpaper', () => {
  it('moves to another family and gradient even if the random source repeats', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (words: Uint32Array) => words.fill(0),
    });
    const first = newHomeWallpaper();
    rememberHomeWallpaper(first);
    const next = newHomeWallpaper();
    expect(next.kind).not.toEqual(first.kind);
    expect(next.gradient).not.toEqual(first.gradient);
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
