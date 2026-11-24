import type { Pattern } from './event-theme.js';

type Tone = 'ink' | 'accent' | 'thread';
interface Mark {
  d: string;
  tone: Tone;
  fill?: boolean;
}
interface Tile {
  width: number;
  height: number;
  marks: Mark[];
  texture?: string;
}
type Pick = (min: number, max: number) => number;

const PALETTES = [
  { base: '#0e1427', ink: '#384a77', accent: '#655483', thread: '#36716a' },
  { base: '#1e101b', ink: '#5b2c4a', accent: '#884e62', thread: '#796035' },
  { base: '#0a1918', ink: '#214944', accent: '#3e7062', thread: '#79643b' },
  { base: '#1b1610', ink: '#553b25', accent: '#846039', thread: '#72504a' },
  { base: '#161124', ink: '#40365e', accent: '#685688', thread: '#416978' },
  { base: '#1f1216', ink: '#5a3037', accent: '#885053', thread: '#486e69' },
  { base: '#111914', ink: '#3b5030', accent: '#687343', thread: '#776047' },
  { base: '#0d1720', ink: '#2b4c5d', accent: '#3f7080', thread: '#655783' },
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

function tileFor(kind: Pattern['kind'], pick: Pick): Tile {
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

export function drawPattern(pattern: Pattern) {
  const random = seeded(pattern.seed);
  const pick: Pick = (min, max) => min + Math.floor(random() * (max - min + 1));
  const palette = PALETTES[pick(0, PALETTES.length - 1)]!;
  return { ...tileFor(pattern.kind, pick), palette, weight: pick(12, 22) / 10 };
}
