import {
  MOTIF_PATTERN_KINDS,
  TEXTILE_PATTERN_KINDS,
  type Pattern,
} from './event-theme.js';

type Tone = 'ink' | 'accent' | 'thread';
interface Mark {
  d: string;
  tone: Tone;
  fill?: boolean;
  transform?: string;
}
interface Tile {
  width: number;
  height: number;
  marks: Mark[];
  texture?: string;
  spacing?: Spacing;
}
type Pick = (min: number, max: number) => number;

// The first eight entries keep the color identity of earlier saved textiles.
const PALETTES = [
  {
    base: '#0e1427',
    ink: '#384a77',
    accent: '#655483',
    thread: '#36716a',
    highlight: '#aebdff',
  },
  {
    base: '#1e101b',
    ink: '#5b2c4a',
    accent: '#884e62',
    thread: '#796035',
    highlight: '#f1a9cb',
  },
  {
    base: '#0a1918',
    ink: '#214944',
    accent: '#3e7062',
    thread: '#79643b',
    highlight: '#91dbc1',
  },
  {
    base: '#1b1610',
    ink: '#553b25',
    accent: '#846039',
    thread: '#72504a',
    highlight: '#f5c384',
  },
  {
    base: '#161124',
    ink: '#40365e',
    accent: '#685688',
    thread: '#416978',
    highlight: '#c9aff3',
  },
  {
    base: '#1f1216',
    ink: '#5a3037',
    accent: '#885053',
    thread: '#486e69',
    highlight: '#f1a69b',
  },
  {
    base: '#111914',
    ink: '#3b5030',
    accent: '#687343',
    thread: '#776047',
    highlight: '#bcda8f',
  },
  {
    base: '#0d1720',
    ink: '#2b4c5d',
    accent: '#3f7080',
    thread: '#655783',
    highlight: '#97d5eb',
  },
  {
    base: '#1c1810',
    ink: '#584521',
    accent: '#786a35',
    thread: '#947035',
    highlight: '#f1da80',
  },
  {
    base: '#1e101e',
    ink: '#5b2b55',
    accent: '#84416b',
    thread: '#6c546f',
    highlight: '#eda4e1',
  },
  {
    base: '#131925',
    ink: '#37476a',
    accent: '#527596',
    thread: '#536f55',
    highlight: '#87d4db',
  },
  {
    base: '#1f1311',
    ink: '#694031',
    accent: '#925640',
    thread: '#89663d',
    highlight: '#f7b294',
  },
] as const;

type MotifKind = (typeof MOTIF_PATTERN_KINDS)[number];
const SPACINGS = ['sparse', 'airy', 'clustered', 'packed'] as const;
type Spacing = (typeof SPACINGS)[number];

const isMotif = (kind: Pattern['kind']): kind is MotifKind =>
  (MOTIF_PATTERN_KINDS as readonly string[]).includes(kind);

function shuffled<T>(values: readonly T[], word: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = word() % (index + 1);
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

/** Five silhouettes and five textiles, with all four silhouette spacings. */
export function patternBatch(
  word: () => number,
  previous: readonly Pattern[] = []
): Pattern[] {
  const oldKinds = new Set(previous.map(({ kind }) => kind));
  const motifs = shuffled(MOTIF_PATTERN_KINDS, word);
  const fresh = motifs.find((kind) => !oldKinds.has(kind)) ?? motifs[0]!;
  const kinds = [
    fresh,
    ...motifs.filter((kind) => kind !== fresh).slice(0, 4),
    ...shuffled(TEXTILE_PATTERN_KINDS, word).slice(0, 5),
  ] as const;
  const layouts = shuffled([0, 1, 2, 3, word() % 4], word);
  return shuffled(
    kinds.map((kind, index) => {
      const random = word() >>> 0;
      let seed =
        index < layouts.length
          ? ((random & ~3) | layouts[index]!) >>> 0
          : random;
      const match = previous.find((pattern) => pattern.kind === kind);
      if (match?.seed === seed) seed = (seed + 4) >>> 0;
      return { kind, seed };
    }),
    word
  );
}

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let word = Math.imul(state ^ (state >>> 15), state | 1);
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
    return ((word ^ (word >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

const line = (d: string, tone: Tone = 'ink'): Mark => ({ d, tone });
const solid = (d: string, tone: Tone = 'ink'): Mark => ({
  d,
  tone,
  fill: true,
});
const rectangle = (x: number, y: number, w: number, h: number) =>
  `M${x},${y}h${w}v${h}h${-w}Z`;
const diamond = (x: number, y: number, w: number, h: number) =>
  `M${x},${y - h}l${w},${h}l${-w},${h}l${-w},${-h}Z`;
const ring = (x: number, y: number, radius: number) =>
  `M${x - radius},${y}a${radius},${radius} 0 1 0 ${radius * 2},0a${radius},${radius} 0 1 0 ${-radius * 2},0Z`;
const TAU = 2 * Math.PI;
const point = (x: number, y: number, radius: number, angle: number) =>
  `${(x + radius * Math.cos(angle)).toFixed(2)},${(y + radius * Math.sin(angle)).toFixed(2)}`;

function star(points: number, inner: number): string {
  const vertices = Array.from({ length: points * 2 }, (_, index) =>
    point(0, 0, index % 2 ? inner : 1, TAU * (index / (points * 2) - 0.25))
  );
  return `M${vertices.join('L')}Z`;
}

const MOTIF_PATHS: Record<MotifKind, (pick: Pick) => string> = {
  stars: (pick) => star(pick(5, 7), pick(39, 59) / 100),
  hearts: () =>
    'M0,.93C-.18,.74-1,.16-.96,-.34C-.92,-.88-.32,-1.05,0,-.54C.32,-1.05,.92,-.88,.96,-.34C1,.16,.18,.74,0,.93Z',
  sparks: (pick) => star(4, pick(17, 27) / 100),
  moons: () => 'M.37,-.93A1,1 0 1 0 .92,.39A.85,.85 0 0 1 .37,-.93Z',
  bows: () =>
    'M-.14,0C-.44,-.55-.98,-.77-.99,-.36L-.99,.36C-.98,.77-.44,.55-.14,0ZM.14,0C.44,-.55,.98,-.77,.99,-.36L.99,.36C.98,.77,.44,.55,.14,0ZM-.14,-.2H.14Q.26,0,.14,.2H-.14Q-.26,0,-.14,-.2Z',
  drops: () =>
    'M0,-1C.14,-.70,.72,-.04,.72,.35A.72,.66 0 0 1 -.72,.35C-.72,-.04,-.14,-.70,0,-1Z',
  petals: () =>
    'M0,0C-.87,-.24-.28,-1,0,-.97C.28,-1,.87,-.24,0,0ZM0,0C.24,-.87,1,-.28,.97,0C1,.28,.24,.87,0,0ZM0,0C.87,.24,.28,1,0,.97C-.28,1,-.87,.24,0,0ZM0,0C-.24,.87,-1,.28,-.97,0C-1,-.28,-.24,-.87,0,0Z',
  rings: (pick) => ring(0, 0, 1) + ring(0, 0, pick(37, 70) / 100),
  butterflies: () =>
    'M0,-.18C-.23,-.96-.92,-1.07-.97,-.62C-1,-.33-.66,-.05-.44,0C-.96,.17-.89,.75-.53,.8C-.28,.83-.12,.51,0,.19C.12,.51,.28,.83,.53,.8C.89,.75,.96,.17,.44,0C.66,-.05,1,-.33,.97,-.62C.92,-1.07,.23,-.96,0,-.18Z' +
    'M-.06,.14Q-.19,-.23,0,-.52Q.19,-.23,.06,.14L0,.73Z',
  ginkgos: () =>
    'M-.08,.91Q-.2,.49,-.12,.22C-.77,.25-1.08,-.2-.88,-.55C-.7,-.89-.3,-.95,-.02,-.58C.28,-.95,.72,-.88,.89,-.55C1.09,-.18,.73,.26,.03,.23Q-.09,.57,.06,.87Z',
  swallows: () =>
    'M-.98,-.65Q-.29,-.78,0,-.22Q.36,-.81,.98,-.66Q.61,-.34,.64,-.06Q.26,.16,.15,.25L.31,.76L0,.49L-.31,.76L-.15,.25Q-.31,.18-.64,-.04Q-.57,-.39-.98,-.65Z',
  lanterns: () =>
    'M-.34,-.92H.34V-.74H-.34ZM0,-.65C.47,-.65,.83,-.31,.83,.06C.83,.44,.48,.68,0,.68C-.48,.68-.83,.44-.83,.06C-.83,-.31-.47,-.65,0,-.65Z' +
    'M-.30,.04C-.30,-.21-.17,-.44,0,-.49C.17,-.44,.30,-.21,.30,.04C.30,.31,.14,.47,0,.52C-.14,.47-.30,.31-.30,.04ZM-.35,.76H.35V.91H-.35Z',
  clovers: (pick) => {
    const offset = pick(31, 42) / 100;
    return (
      [
        [offset, offset],
        [-offset, offset],
        [-offset, -offset],
        [offset, -offset],
      ]
        .map(([x, y]) => ring(x!, y!, offset))
        .join('') + ring(0, 0, 0.18)
    );
  },
  shells: () =>
    'M0,.83L-.78,.14Q-1,-.14-.74,-.39Q-.73,-.7-.39,-.67Q-.28,-.94,0,-.88Q.28,-.94,.39,-.67Q.73,-.7,.74,-.39Q1,-.14,.78,.14Z' +
    'M-.47,-.39L-.07,.53L-.34,-.51ZM.47,-.39L.07,.53L.34,-.51ZM-.07,-.61L0,.54L.07,-.61Z',
  comets: (pick) =>
    'M-.94,.68Q-.64,-.22,.17,-.61Q-.33,-.15-.4,.01Q-.37,.06-.19,.05Q-.53,.41-.94,.68Z' +
    ring(0.4, -0.38, pick(24, 39) / 100),
  umbrellas: () =>
    'M-.92,.04C-.93,-.35-.53,-.79-.05,-.80L-.02,-.94H.12L.14,-.78C.57,-.70,.9,-.33,.91,.04Q.63,-.17,.34,.04Q.06,-.17-.23,.04Q-.56,-.18-.92,.04Z' +
    'M-.02,-.01H.12V.60Q.12,.83,.35,.75L.39,.88Q-.02,1.03-.02,.63Z',
};

function motifTile(kind: MotifKind, spacing: Spacing, pick: Pick): Tile {
  const pitch = {
    sparse: () => pick(92, 132),
    airy: () => pick(42, 59),
    clustered: () => pick(48, 64),
    packed: () => pick(17, 24),
  }[spacing]();
  const side = pitch * 2;
  const d = MOTIF_PATHS[kind](pick);
  const marks: Mark[] = [];
  const tones = ['ink', 'accent', 'thread'] as const;

  function stamp(
    x: number,
    y: number,
    radius: number,
    angle: number,
    tone: Tone
  ) {
    // Wrap the part of a packed motif that crosses a tile edge.
    const horizontal =
      x < radius ? [x, x + side] : x > side - radius ? [x, x - side] : [x];
    const vertical =
      y < radius ? [y, y + side] : y > side - radius ? [y, y - side] : [y];
    for (const left of horizontal) {
      for (const top of vertical) {
        marks.push({
          d,
          tone,
          fill: true,
          transform: `translate(${left.toFixed(2)} ${top.toFixed(2)}) rotate(${angle}) scale(${radius.toFixed(2)})`,
        });
      }
    }
  }

  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const packed = spacing === 'packed';
      const jitter = packed ? 0 : Math.floor(pitch * 0.17);
      const x = (column + 0.5) * pitch + pick(-jitter, jitter);
      const y = (row + 0.5) * pitch + pick(-jitter, jitter);
      const radius = packed ? pitch * 0.58 : pick(8, 13);
      const tilt = pick(-35, 35);
      stamp(x, y, radius, tilt, tones[pick(0, 2)]!);
      if (spacing === 'clustered') {
        const angle = (pick(0, 359) * TAU) / 360;
        for (const offset of [0, 2.2]) {
          const direction = angle + offset;
          stamp(
            x + (radius + 8) * Math.cos(direction),
            y + (radius + 8) * Math.sin(direction),
            pick(3, 6),
            pick(-45, 45),
            'thread'
          );
        }
      }
    }
  }
  return { width: side, height: side, marks, spacing };
}

function printedDots(pick: Pick): Tile {
  const pitch = pick(23, 31);
  const tones = ['ink', 'accent', 'thread'] as const;
  const marks: Mark[] = [];
  const texture: string[] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const x = (column + (row % 2 ? 0.58 : 0.42)) * pitch + pick(-2, 2);
      const y = (row + 0.5) * pitch + pick(-2, 2);
      const radius = pick(Math.floor(pitch / 5), Math.floor(pitch / 3));
      marks.push(solid(ring(x, y, radius), tones[pick(0, 2)]!));
      const spacing = pick(2, 3);
      for (let dy = 1 - radius; dy < radius; dy += spacing) {
        for (
          let dx = 1 - radius + Math.abs(dy % 2);
          dx < radius;
          dx += spacing
        ) {
          if (Math.hypot(dx, dy) < radius - 1)
            texture.push(`M${x + dx},${y + dy}l.7,-.7`);
        }
      }
    }
  }
  // Tiny dark cuts suggest the uneven ink coverage of a printed fabric.
  return {
    width: pitch * 4,
    height: pitch * 4,
    marks,
    texture: texture.join(''),
  };
}

function spirals(pick: Pick): Tile {
  const size = pick(28, 41);
  const turns = pick(8, 11) / 4;
  const start = (pick(0, 3) * TAU) / 4;
  const marks = Array.from({ length: 4 }, (_, index) => {
    const x = ((index % 2) + 0.5) * size;
    const y = (Math.floor(index / 2) + 0.5) * size;
    const direction = index % 2 ? -1 : 1;
    const curve = Array.from({ length: 65 }, (_, segment) => {
      const progress = segment / 64;
      return point(
        x,
        y,
        1 + progress * (size / 2 - 3),
        start + direction * progress * turns * TAU
      );
    });
    return line(
      `M${curve.join('L')}`,
      index === 0 || index === 3 ? 'accent' : 'thread'
    );
  });
  return { width: size * 2, height: size * 2, marks };
}

function blossoms(pick: Pick): Tile {
  const size = pick(27, 40);
  const petals = pick(5, 8);
  const radius = (size * pick(32, 42)) / 100;
  const spread = (TAU / petals) * 0.37;
  const step = TAU / petals;
  const marks: Mark[] = [];
  for (const [column, row] of [
    [0, 0],
    [1, 0],
    [0.5, 1],
    [1.5, 1],
  ] as const) {
    const x = (column + 0.25) * size;
    const y = (row + 0.5) * size;
    const rotation = (row * step) / 2;
    const flower = (center: number) =>
      Array.from({ length: petals }, (_, index) => {
        const angle = index * step + rotation;
        const tip = point(center, y, radius, angle);
        const root = point(center, y, 2, angle);
        const left = point(center, y, radius * 0.73, angle - spread);
        const right = point(center, y, radius * 0.73, angle + spread);
        return `M${root}Q${left} ${tip}Q${right} ${root}Z`;
      }).join('');
    const tone = row ? 'accent' : 'ink';
    marks.push(solid(flower(x), tone), solid(ring(x, y, 1.7), 'thread'));
    // Repeat the portion of each outer blossom cut by the tile edge.
    if (column === 0) marks.push(solid(flower(x + size * 2), tone));
    if (column === 1.5) marks.push(solid(flower(x - size * 2), tone));
  }
  return { width: size * 2, height: size * 2, marks };
}

function honeycomb(pick: Pick): Tile {
  const r = pick(13, 21);
  const step = r * Math.sqrt(3);
  const marks: Mark[] = [];
  for (const [column, row] of [
    [0, 0],
    [1, 0],
    [2, 0],
    [0.5, 1],
    [1.5, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ] as const) {
    const x = column * step;
    const y = row * r * 1.5;
    const hexagon = (radius: number) =>
      `M${Array.from({ length: 6 }, (_, index) =>
        point(x, y, radius, TAU * (index / 6 + 0.25))
      ).join('L')}Z`;
    marks.push(
      line(hexagon(r - 0.7), 'accent'),
      line(hexagon(r - 3.4)),
      solid(ring(x, y, 1.4), 'thread')
    );
  }
  return { width: step * 2, height: r * 3, marks };
}

function tileFor(
  kind: (typeof TEXTILE_PATTERN_KINDS)[number],
  pick: Pick
): Tile {
  switch (kind) {
    case 'printed-dots':
      return printedDots(pick);
    case 'gingham': {
      const step = pick(10, 23);
      const side = step * 2;
      return {
        width: side,
        height: side,
        marks: [
          solid(rectangle(0, step, step, step)),
          solid(rectangle(step, 0, step, step)),
          solid(rectangle(step, step, step, step), 'accent'),
        ],
      };
    }
    case 'stripes': {
      const step = pick(15, 29);
      const vertical = pick(0, 1) === 1;
      const band = (offset: number, width: number) =>
        vertical
          ? rectangle(offset, 0, width, step)
          : rectangle(0, offset, step, width);
      return {
        width: step,
        height: step,
        marks: [
          solid(band(0, Math.floor(step / 3))),
          solid(band(Math.floor(step / 2), pick(1, 3)), 'accent'),
          solid(band(step - 3, 1), 'thread'),
        ],
      };
    }
    case 'checkerboard': {
      const step = pick(10, 22);
      const side = step * 2;
      const tone = pick(0, 1) ? 'ink' : 'accent';
      return {
        width: side,
        height: side,
        marks: [
          solid(rectangle(0, 0, step, step), tone),
          solid(rectangle(step, step, step, step), tone),
        ],
      };
    }
    case 'spirals':
      return spirals(pick);
    case 'blossoms':
      return blossoms(pick);
    case 'diamonds': {
      const width = pick(17, 29);
      const height = pick(15, 25);
      const marks: Mark[] = [];
      for (const [x, y] of [
        [0, 0],
        [2, 0],
        [1, 1],
        [0, 2],
        [2, 2],
      ] as const) {
        marks.push(
          line(diamond(x * width, y * height, width - 1, height - 1), 'ink'),
          line(
            diamond(x * width, y * height, width * 0.7, height * 0.7),
            'accent'
          ),
          solid(
            diamond(x * width, y * height, width * 0.32, height * 0.32),
            'thread'
          )
        );
      }
      return { width: width * 2, height: height * 2, marks };
    }
    case 'lattice': {
      const step = pick(15, 30);
      const side = step * 2;
      return {
        width: side,
        height: side,
        marks: [
          line(`M0,0L${side},${side}M${side},0L0,${side}`, 'accent'),
          line(`M0,${step}L${step},0L${side},${step}L${step},${side}Z`),
          solid(diamond(step / 2, step, 2, 2), 'thread'),
          solid(diamond(step * 1.5, step, 2, 2), 'thread'),
        ],
      };
    }
    case 'honeycomb':
      return honeycomb(pick);
    case 'chevrons': {
      const half = pick(14, 24);
      const step = pick(8, 12);
      const width = half * 4;
      return {
        width,
        height: step * 4,
        marks: Array.from({ length: 7 }, (_, row) => {
          const y = (row - 2) * step;
          return line(
            `M0,${y}l${half},${step}${half},${-step}${half},${step}${half},${-step}`,
            row % 2 ? 'accent' : 'ink'
          );
        }),
      };
    }
    case 'scallops': {
      const radius = pick(13, 23);
      const diameter = radius * 2;
      const marks: Mark[] = [];
      for (const [x, y] of [
        [0, 0],
        [diameter, 0],
        [radius, radius],
        [0, diameter],
        [diameter, diameter],
      ] as const) {
        for (const scale of [0.43, 0.72, 0.96]) {
          const r = radius * scale;
          marks.push(
            line(
              `M${x - r},${y}a${r},${r} 0 0 1 ${2 * r},0`,
              scale === 0.72 ? 'accent' : 'ink'
            )
          );
        }
      }
      return { width: diameter, height: diameter, marks };
    }
    case 'waves': {
      const width = pick(42, 70);
      const step = pick(6, 11);
      const rise = pick(7, 13);
      return {
        width,
        height: step * 6,
        marks: Array.from({ length: 11 }, (_, row) => {
          const y = (row - 2) * step;
          return line(
            `M0,${y}C${width / 4},${y - rise} ${width / 4},${y - rise} ${width / 2},${y}S${(3 * width) / 4},${y + rise} ${width},${y}`,
            row % 3 === 0 ? 'thread' : 'ink'
          );
        }),
      };
    }
    case 'azulejo': {
      const side = pick(31, 52);
      const center = side / 2;
      const marks: Mark[] = [
        line(diamond(center, center, center, center), 'ink'),
        solid(diamond(center, center, side / 9, side / 9), 'thread'),
      ];
      for (const angle of [0, 1, 2, 3].map((turn) => (turn * TAU) / 4)) {
        const tip = point(center, center, side * 0.42, angle);
        const left = point(center, center, side * 0.25, angle - 0.6);
        const right = point(center, center, side * 0.25, angle + 0.6);
        marks.push(
          solid(
            `M${center},${center}Q${left} ${tip}Q${right} ${center},${center}Z`,
            'accent'
          )
        );
      }
      return { width: side, height: side, marks };
    }
    case 'houndstooth': {
      const step = pick(3, 6);
      const marks: Mark[] = [];
      for (let row = 0; row < 8; row += 1) {
        for (let column = 0; column < 8; column += 1) {
          const darkWarp = row < 4;
          const darkWeft = column < 4;
          const stripe = (column + row) % 4;
          if (darkWarp === darkWeft ? darkWarp : stripe < 2) {
            marks.push(
              solid(
                rectangle(column * step, row * step, step, step),
                darkWarp && darkWeft ? 'accent' : 'ink'
              )
            );
          }
        }
      }
      return { width: step * 8, height: step * 8, marks };
    }
  }
}

function paletteIndex(pattern: Pattern, random: () => number) {
  const length = isMotif(pattern.kind) ? PALETTES.length : 8;
  return Math.floor(random() * length);
}

export function patternPalette(pattern: Pattern) {
  return PALETTES[paletteIndex(pattern, seeded(pattern.seed))]!;
}

/** Layered elliptical color fields, with a separate seed from the tile geometry. */
export function wallpaperLight(seed: number) {
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
      opacity: 0.51,
    },
    {
      tone: 'thread',
      x: mirror(0.68 + random() * 0.26),
      y: 0.63 + random() * 0.21,
      radius: 0.76,
      squash: 0.69,
      angle: flip * (tilt - 29),
      opacity: 0.42,
    },
    {
      tone: 'ink',
      x: mirror(0.23 + random() * 0.3),
      y: 0.79 + random() * 0.18,
      radius: 0.75,
      squash: 0.42,
      angle: flip * (tilt + 17),
      opacity: 0.49,
    },
    {
      tone: 'highlight',
      x: mirror(0.54 + random() * 0.24),
      y: 0.02 + random() * 0.26,
      radius: 0.69,
      squash: 0.38,
      angle: flip * (tilt + 48),
      opacity: 0.18,
    },
  ] as const;
}

export function drawPattern(pattern: Pattern) {
  const random = seeded(pattern.seed);
  const index = paletteIndex(pattern, random);
  const pick: Pick = (min, max) => min + Math.floor(random() * (max - min + 1));
  const { kind, seed } = pattern;
  const tile = isMotif(kind)
    ? motifTile(kind, SPACINGS[seed % SPACINGS.length]!, pick)
    : tileFor(kind, pick);
  return { ...tile, palette: PALETTES[index]!, weight: pick(12, 22) / 10 };
}
