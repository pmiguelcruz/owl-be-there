import { describe, expect, it } from 'vitest';
import {
  MOTIF_PATTERN_KINDS,
  PatternSpec,
  patternFor,
  PATTERN_KINDS,
} from '../src/event-theme.js';
import {
  drawPattern,
  patternBatch,
  patternPalette,
  wallpaperLight,
  wallpaperGradient,
  wallpaperGrowth,
} from '../src/patterns.js';

describe('wallpaper recipes', () => {
  it.each(PATTERN_KINDS)(
    'draws distinct, repeatable %s tiles against a near-black base',
    (kind) => {
      const recipe = { kind, seed: 112 };
      const tile = drawPattern(recipe);
      expect(drawPattern({ ...recipe })).toEqual(tile);
      expect(patternPalette(recipe)).toEqual(tile.palette);
      expect(drawPattern({ kind, seed: 417 }).marks).not.toEqual(tile.marks);
      expect(tile.width).toBeGreaterThan(0);
      expect(tile.height).toBeGreaterThan(0);
      expect(tile.marks.length).toBeGreaterThan(0);
      for (const mark of tile.marks) expect(mark.d).not.toMatch(/NaN|Infinity/);
      const channels = tile.palette.base.match(/[a-f\d]{2}/gi)!;
      expect(
        Math.max(...channels.map((channel) => parseInt(channel, 16)))
      ).toBeLessThan(40);
    }
  );

  it('offers distinct families and every silhouette spacing in each batch', () => {
    const word = () => 0xffff_ffff;
    const first = patternBatch(word);
    const second = patternBatch(word, first);
    const extremes = (batch: ReturnType<typeof patternBatch>) =>
      new Set(batch.map((pattern) => drawPattern(pattern).spacing));
    for (const batch of [first, second]) {
      expect(batch).toHaveLength(10);
      expect(new Set(batch.map(({ kind }) => kind)).size).toBe(10);
      expect(new Set(batch.map(({ gradient }) => gradient))).toEqual(
        new Set(['flow', 'linear', 'radial'])
      );
      expect(extremes(batch)).toEqual(
        new Set([undefined, 'sparse', 'airy', 'clustered', 'packed'])
      );
      for (const recipe of batch)
        expect(PatternSpec.parse(recipe)).toEqual(recipe);
    }
    expect(
      second.some(({ kind }) => !first.some((pattern) => pattern.kind === kind))
    ).toBe(true);
    expect(
      second.some(({ kind, seed }) =>
        first.some((pattern) => pattern.kind === kind && pattern.seed === seed)
      )
    ).toBe(false);
  });

  it('offers one selectable wild pattern on one outcome in five', () => {
    for (const roll of [0, 1, 2, 3, 4]) {
      const batch = patternBatch(() => roll);
      const wild = batch.filter((pattern) => pattern.wild);
      expect(batch).toHaveLength(10);
      expect(wild).toHaveLength(roll === 0 ? 1 : 0);
      if (wild[0]) {
        const { kind, seed } = wild[0];
        expect(PatternSpec.parse(wild[0])).toEqual(wild[0]);
        expect(patternPalette(wild[0])).not.toEqual(
          patternPalette({ kind, seed })
        );
      }
    }
  });

  it.each(MOTIF_PATTERN_KINDS)(
    'gives %s a spacious repeat and a much tighter repeat',
    (kind) => {
      const sparse = drawPattern({ kind, seed: 0 });
      const packed = drawPattern({ kind, seed: 3 });
      expect(sparse.spacing).toBe('sparse');
      expect(packed.spacing).toBe('packed');
      expect(sparse.width).toBeGreaterThan(packed.width * 3);
      expect(packed.marks).toHaveLength(sparse.marks.length);
      expect(packed.marks.every((mark) => mark.center && mark.radius)).toBe(
        true
      );
    }
  );

  it('recreates the same overlapping colored gradients for a saved seed', () => {
    const lights = wallpaperLight(86753);
    expect(wallpaperLight(86753)).toEqual(lights);
    expect(wallpaperLight(86754)).not.toEqual(lights);
    const wild = wallpaperLight(86753, true);
    expect(
      wild
        .map(({ opacity }) => opacity)
        .every((opacity, index) => opacity > lights[index]!.opacity)
    ).toBe(true);
    expect(lights.map(({ tone }) => tone)).toEqual([
      'accent',
      'thread',
      'ink',
      'highlight',
    ]);
    for (const { x, y, radius, squash, opacity } of lights) {
      expect([x, y].every((center) => center >= 0 && center <= 1)).toBe(true);
      expect(radius).toBeGreaterThan(0.5);
      expect(squash).toBeLessThan(1);
      expect(opacity).toBeLessThan(0.8);
    }
  });

  it('scales marks along a straight gradient and around the center of a radial gradient', () => {
    const pattern = { kind: 'stars', seed: 540 } as const;
    const linear = wallpaperGradient({ ...pattern, gradient: 'linear' });
    const radial = wallpaperGradient({ ...pattern, gradient: 'radial' });
    if (linear.style !== 'linear' || radial.style !== 'radial')
      throw new Error('Unexpected wallpaper gradient');
    const growLinear = wallpaperGrowth(linear);
    const growRadial = wallpaperGrowth(radial);
    const [x, y] = linear.from;
    const dx = linear.to[0] - x;
    const dy = linear.to[1] - y;
    const middle = [x + dx * 0.54, y + dy * 0.54] as const;
    expect(growLinear(...middle)).toBeGreaterThan(growLinear(x, y));
    expect(growLinear(middle[0] - dy * 0.1, middle[1] + dx * 0.1)).toBeCloseTo(
      growLinear(...middle)
    );
    const [cx, cy] = radial.center;
    expect(growRadial(cx, cy)).toBeGreaterThan(
      growRadial(cx + radial.radius * 0.5, cy)
    );
    expect(growRadial(cx + radial.radius * 0.5, cy)).toBeCloseTo(
      growRadial(cx, cy - radial.radius * 0.5)
    );
    expect(wallpaperGradient(pattern).style).toBe('flow');
  });

  it('restores a saved recipe and gives older events stable wallpapers', () => {
    const legacy = {
      gradient: { start: '#ffffff', end: '#000000', angle: 3 },
      shape: 27,
    };
    const migrated = patternFor('legacy', legacy);
    expect(PatternSpec.parse(migrated)).toEqual(migrated);
    expect(patternFor('legacy', { ...legacy })).toEqual(migrated);
    expect(patternFor('legacy')).not.toEqual(migrated);
    expect(patternFor('older')).not.toEqual(patternFor('legacy'));
    expect(patternFor('other', { version: 1, pattern: migrated })).toEqual(
      migrated
    );
  });
});
