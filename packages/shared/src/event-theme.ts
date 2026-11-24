import { z } from 'zod';

export const PATTERN_KINDS = [
  'printed-dots',
  'gingham',
  'stripes',
  'checkerboard',
  'spirals',
  'blossoms',
  'diamonds',
  'lattice',
  'honeycomb',
  'houndstooth',
] as const;

export const PatternSpec = z.strictObject({
  kind: z.enum(PATTERN_KINDS),
  seed: z.int().min(0).max(0xffff_ffff),
});

export type Pattern = z.infer<typeof PatternSpec>;

export const PatternTheme = z.strictObject({
  version: z.literal(1),
  pattern: PatternSpec,
});

export type PatternThemeData = z.infer<typeof PatternTheme>;

const color = z.string().regex(/^#[a-f0-9]{6}$/i);

// Keep decoding themes written by earlier versions. New selections store a
// pattern recipe, so the same wallpaper can be rendered on any device.
const LegacyTheme = z.strictObject({
  gradient: z.strictObject({
    start: color,
    end: color,
    angle: z.int().min(0).max(359),
  }),
  shape: z.int().min(0).max(0xffff_ffff),
});

export const EventTheme = z.union([PatternTheme, LegacyTheme]);

export type EventThemeData = z.infer<typeof EventTheme>;

export function patternFor(id: string, theme?: EventThemeData): Pattern {
  if (theme && 'pattern' in theme) return theme.pattern;
  const identity = theme
    ? `${id}:${theme.gradient.start}:${theme.gradient.end}:${theme.gradient.angle}:${theme.shape}`
    : id;
  let seed = 2166136261;
  for (const character of identity)
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  return { kind: PATTERN_KINDS[seed % PATTERN_KINDS.length]!, seed };
}
