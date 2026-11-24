import { describe, expect, it } from 'vitest';
import { PatternSpec, patternFor, PATTERN_KINDS } from '../src/event-theme.js';
import { drawPattern } from '../src/patterns.js';

describe('wallpaper recipes', () => {
  it.each(PATTERN_KINDS)(
    'draws distinct, repeatable %s tiles against a near-black base',
    (kind) => {
      const recipe = { kind, seed: 112 };
      const tile = drawPattern(recipe);
      expect(drawPattern({ ...recipe })).toEqual(tile);
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
