import { describe, expect, it } from 'vitest';
import { lookFor, WallpaperLookSpec } from '../src/event-theme.js';
import { lookBatch, lookPalette, wallpaperGradient } from '../src/wallpaper.js';

describe('wallpaper looks', () => {
  it('offers ten distinct looks and all three gradient styles, even with repeated entropy', () => {
    const first = lookBatch(() => 42);
    const next = lookBatch(() => 42, first);
    for (const batch of [first, next]) {
      expect(batch).toHaveLength(10);
      expect(new Set(batch.map(({ seed }) => seed)).size).toBe(10);
      expect(new Set(batch.map(({ gradient }) => gradient))).toEqual(
        new Set(['flow', 'linear', 'radial'])
      );
      for (const look of batch) {
        expect(WallpaperLookSpec.parse(look)).toEqual(look);
        expect(look.kind).toBeUndefined();
      }
    }
    expect(
      next.some(({ seed }) => first.some((look) => look.seed === seed))
    ).toBe(false);
  });

  it('includes one wild look on one roll out of five', () => {
    for (const roll of [0, 1, 2, 3, 4]) {
      const wild = lookBatch(() => roll).filter((look) => look.wild);
      expect(wild).toHaveLength(roll === 0 ? 1 : 0);
      if (wild[0]) {
        const { seed } = wild[0];
        expect(lookPalette(wild[0])).not.toEqual(lookPalette({ seed }));
      }
    }
  });

  it('preserves the color family of saved looks from earlier versions', () => {
    expect(lookPalette({ kind: 'printed-dots', seed: 112 }).base).toBe(
      '#161124'
    );
    expect(lookPalette({ kind: 'stars', seed: 112 })).toEqual(
      lookPalette({ seed: 112 })
    );
    expect(
      lookPalette({ kind: 'printed-dots', seed: 112, wild: true })
    ).toEqual(lookPalette({ seed: 112, wild: true }));
    const legacy = {
      gradient: { start: '#aa7434', end: '#601f84', angle: 34 },
      shape: 4,
    };
    const look = lookFor('event-id', legacy);
    expect(WallpaperLookSpec.parse(look)).toEqual(look);
    expect(lookFor('event-id', legacy)).toEqual(look);
    expect(lookFor('other', { version: 1, pattern: look })).toEqual(look);
    expect(lookFor('event-id')).not.toEqual(look);
  });

  it('recreates linear, radial, and layered gradients deterministically from a recipe', () => {
    const look = { seed: 86753, gradient: 'flow' } as const;
    const flow = wallpaperGradient(look);
    const wild = wallpaperGradient({ ...look, wild: true });
    const linear = wallpaperGradient({ ...look, gradient: 'linear' });
    const radial = wallpaperGradient({ ...look, gradient: 'radial' });
    expect(wallpaperGradient({ seed: look.seed })).toEqual(flow);
    expect(wallpaperGradient({ ...look, seed: look.seed + 1 })).not.toEqual(
      flow
    );
    if (
      flow.style !== 'flow' ||
      wild.style !== 'flow' ||
      linear.style !== 'linear' ||
      radial.style !== 'radial'
    )
      throw new Error('Incorrect gradient style');
    expect(flow.lights).toHaveLength(4);
    expect(
      wild.lights.every(
        ({ opacity }, index) => opacity > flow.lights[index]!.opacity
      )
    ).toBe(true);
    expect(linear.from).not.toEqual(linear.to);
    expect(
      radial.center.every((coordinate) => coordinate > 0 && coordinate < 1)
    ).toBe(true);
  });
});
