import {
  LEGACY_TEXTILE_KINDS,
  WALLPAPER_GRADIENTS,
  type WallpaperLook,
} from './event-theme.js';

type Point = readonly [x: number, y: number];
const TAU = Math.PI * 2;

// Keep palette order stable so previously saved looks keep their colors.
const PALETTES = [
  {
    base: '#0e1427',
    ink: '#283fbd',
    accent: '#7a49f8',
    thread: '#00b5c5',
    highlight: '#859cff',
    lettering: '#b4c6ff',
  },
  {
    base: '#1e101b',
    ink: '#7c1dc2',
    accent: '#f4309d',
    thread: '#f88d25',
    highlight: '#ff78b6',
    lettering: '#ffb8db',
  },
  {
    base: '#0a1918',
    ink: '#0c8065',
    accent: '#00d393',
    thread: '#23a1ee',
    highlight: '#48edb0',
    lettering: '#a0ffd6',
  },
  {
    base: '#1b1610',
    ink: '#9c3819',
    accent: '#ff712c',
    thread: '#f5c41c',
    highlight: '#ffaf4b',
    lettering: '#ffd597',
  },
  {
    base: '#161124',
    ink: '#5022be',
    accent: '#b72afd',
    thread: '#fa509b',
    highlight: '#c499ff',
    lettering: '#dfbaff',
  },
  {
    base: '#1f1216',
    ink: '#a12864',
    accent: '#ff4d5e',
    thread: '#faa62d',
    highlight: '#ff8b7a',
    lettering: '#ffbeb1',
  },
  {
    base: '#111914',
    ink: '#3c7620',
    accent: '#a7dc19',
    thread: '#00ae93',
    highlight: '#b8e654',
    lettering: '#dcfc95',
  },
  {
    base: '#0d1720',
    ink: '#195fbd',
    accent: '#18baf4',
    thread: '#9251fa',
    highlight: '#51d3ff',
    lettering: '#a6e9ff',
  },
  {
    base: '#1c1810',
    ink: '#855015',
    accent: '#ffd21a',
    thread: '#fb6242',
    highlight: '#ffda2e',
    lettering: '#ffe48c',
  },
  {
    base: '#1e101e',
    ink: '#7f2374',
    accent: '#f32fcb',
    thread: '#8841ff',
    highlight: '#ff79da',
    lettering: '#ffb7ed',
  },
  {
    base: '#131925',
    ink: '#1c5ead',
    accent: '#1adfc8',
    thread: '#7360ff',
    highlight: '#63efd8',
    lettering: '#afffed',
  },
  {
    base: '#1f1311',
    ink: '#9b3329',
    accent: '#ff754f',
    thread: '#f33c88',
    highlight: '#ff9b6d',
    lettering: '#ffbe99',
  },
] as const;

const WILD_PALETTES = [
  {
    base: '#140b26',
    ink: '#9417e4',
    accent: '#fd13b2',
    thread: '#87fb03',
    highlight: '#c4ff19',
    lettering: '#e3ff94',
  },
  {
    base: '#0b142b',
    ink: '#173fea',
    accent: '#1d43ff',
    thread: '#ff2aaf',
    highlight: '#21f3ec',
    lettering: '#a5fcfa',
  },
  {
    base: '#220b12',
    ink: '#d8109d',
    accent: '#ff3c49',
    thread: '#ffcb08',
    highlight: '#ffbf27',
    lettering: '#ffe482',
  },
  {
    base: '#071b19',
    ink: '#087cde',
    accent: '#00f58a',
    thread: '#fe3fa7',
    highlight: '#3dffaa',
    lettering: '#aeffd1',
  },
] as const;

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let word = Math.imul(state ^ (state >>> 15), state | 1);
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
    return ((word ^ (word >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

export function lookPalette(look: WallpaperLook) {
  const random = seeded(look.seed)();
  if (look.wild)
    return WILD_PALETTES[Math.floor(random * WILD_PALETTES.length)]!;
  const usedClassicPalette = (
    LEGACY_TEXTILE_KINDS as readonly string[]
  ).includes(look.kind ?? '');
  return PALETTES[
    Math.floor(random * (usedClassicPalette ? 8 : PALETTES.length))
  ]!;
}

export function lookBatch(
  word: () => number,
  previous: readonly WallpaperLook[] = []
): WallpaperLook[] {
  const size = 10;
  const wildSlot = word() % 5 === 0 ? word() % size : -1;
  const firstStyle = word() % WALLPAPER_GRADIENTS.length;
  const used = new Set(previous.map(({ seed }) => seed));
  return Array.from({ length: size }, (_, index) => {
    let seed = word() >>> 0;
    while (used.has(seed)) seed = (seed + 1) >>> 0;
    used.add(seed);
    return {
      seed,
      gradient:
        WALLPAPER_GRADIENTS[(firstStyle + index) % WALLPAPER_GRADIENTS.length]!,
      ...(index === wildSlot && { wild: true as const }),
    };
  });
}

/** Layered elliptical color fields, with a separate seed from the tile geometry. */
export function wallpaperLight(seed: number, wild = false) {
  const random = seeded((seed ^ 0x37ecad81) >>> 0);
  const tilt = 35 + random() * 100;
  const flip = random() < 0.5 ? 1 : -1;
  const mirror = (x: number) => (flip > 0 ? x : 1 - x);
  return [
    {
      tone: 'accent',
      x: mirror(0.1 + random() * 0.22),
      y: 0.12 + random() * 0.2,
      radius: 0.71,
      squash: 0.61,
      angle: flip * tilt,
      opacity: wild ? 0.94 : 0.77,
    },
    {
      tone: 'thread',
      x: mirror(0.68 + random() * 0.26),
      y: 0.63 + random() * 0.21,
      radius: 0.76,
      squash: 0.69,
      angle: flip * (tilt - 29),
      opacity: wild ? 0.85 : 0.65,
    },
    {
      tone: 'ink',
      x: mirror(0.23 + random() * 0.3),
      y: 0.79 + random() * 0.18,
      radius: 0.75,
      squash: 0.42,
      angle: flip * (tilt + 17),
      opacity: wild ? 0.78 : 0.61,
    },
    {
      tone: 'highlight',
      x: mirror(0.54 + random() * 0.24),
      y: 0.02 + random() * 0.26,
      radius: 0.69,
      squash: 0.38,
      angle: flip * (tilt + 48),
      opacity: wild ? 0.78 : 0.42,
    },
  ] as const;
}

/** Endpoints and centers use the same normalized coordinates as the SVG. */
export function wallpaperGradient(look: WallpaperLook) {
  const random = seeded((look.seed ^ 0x83ddc9cd) >>> 0);
  const style = look.gradient ?? 'flow';
  if (style === 'linear') {
    const angle = (Math.floor(random() * 12) * TAU) / 12;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const extent = (Math.abs(dx) + Math.abs(dy)) / 2;
    const from: Point = [0.5 - dx * extent, 0.5 - dy * extent];
    const to: Point = [0.5 + dx * extent, 0.5 + dy * extent];
    return { style, from, to } as const;
  }
  if (style === 'radial') {
    const center: Point = [0.18 + random() * 0.64, 0.18 + random() * 0.64];
    return { style, center, radius: 0.75 + random() * 0.25 } as const;
  }
  return { style, lights: wallpaperLight(look.seed, look.wild) } as const;
}
