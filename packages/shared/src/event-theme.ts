import { z } from 'zod';

export const LEGACY_TEXTILE_KINDS = [
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
  'chevrons',
  'scallops',
  'waves',
  'azulejo',
] as const;

const legacyKinds = [
  ...LEGACY_TEXTILE_KINDS,
  'stars',
  'hearts',
  'sparks',
  'moons',
  'bows',
  'drops',
  'petals',
  'rings',
  'butterflies',
  'ginkgos',
  'swallows',
  'lanterns',
  'clovers',
  'shells',
  'comets',
  'umbrellas',
] as const;

export const WALLPAPER_GRADIENTS = ['flow', 'linear', 'radial'] as const;

export const WallpaperLookSpec = z.strictObject({
  // Old recipes retain their palette family. New looks only store gradients.
  kind: z.enum(legacyKinds).optional(),
  seed: z.int().min(0).max(0xffff_ffff),
  wild: z.literal(true).optional(),
  gradient: z.enum(WALLPAPER_GRADIENTS).optional(),
});

export type WallpaperLook = z.infer<typeof WallpaperLookSpec>;

export const WallpaperTheme = z.strictObject({
  version: z.literal(1),
  pattern: WallpaperLookSpec,
});

const color = z.string().regex(/^#[a-f0-9]{6}$/i);

// Keep decoding themes written by earlier versions. New selections store a
// gradient recipe, so the same wallpaper can be rendered on any device.
const LegacyTheme = z.strictObject({
  gradient: z.strictObject({
    start: color,
    end: color,
    angle: z.int().min(0).max(359),
  }),
  shape: z.int().min(0).max(0xffff_ffff),
});

export const EventTheme = z.union([WallpaperTheme, LegacyTheme]);

export type EventThemeData = z.infer<typeof EventTheme>;

export function lookFor(id: string, theme?: EventThemeData): WallpaperLook {
  if (theme && 'pattern' in theme) return theme.pattern;
  const identity = theme
    ? `${id}:${theme.gradient.start}:${theme.gradient.end}:${theme.gradient.angle}:${theme.shape}`
    : id;
  let seed = 2166136261;
  for (const character of identity)
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  return {
    kind: 'printed-dots',
    seed,
  };
}
