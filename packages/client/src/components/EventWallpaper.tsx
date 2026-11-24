import type { EventThemeData } from '@owl/shared';
import { useId } from 'react';

const TILE = 72;
const CENTER = TILE / 2;

/** Evenly spaced, mirrored points form a rotationally symmetric motif. */
function shapePath(seed: number): string {
  const arms = (seed % 5) + 3;
  const angle = (((seed >>> 8) % 360) * Math.PI) / 180;
  const outer = 20 + ((seed >>> 16) % 9);
  const inner = outer * (0.37 + ((seed >>> 24) % 37) / 100);
  const roundness = (seed >>> 4) % 3;
  const points = Array.from({ length: arms * 2 }, (_, index) => {
    const radius = index % 2 ? inner : outer;
    const offset = angle + (index * Math.PI) / arms;
    return {
      x: CENTER + radius * Math.cos(offset),
      y: CENTER + radius * Math.sin(offset),
    };
  });
  const coordinates = (point: { x: number; y: number }) =>
    `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  if (roundness === 0) return `M${points.map(coordinates).join('L')}Z`;
  const between = (index: number) => {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    return coordinates({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  };
  const curve = points.map((point, index) => {
    const smooth = roundness === 2 || index % 2 === 0;
    return smooth
      ? `Q${coordinates(point)} ${between(index)}`
      : `L${coordinates(point)}L${between(index)}`;
  });
  return `M${between(points.length - 1)}${curve.join('')}Z`;
}

export function EventWallpaper({
  gradient,
  shape,
  className,
  single = false,
}: {
  gradient: EventThemeData['gradient'];
  /** Without a shape, render a swatch for the gradient picker. */
  shape?: number;
  className: string;
  single?: boolean;
}) {
  const id = useId();
  const gradientId = `gradient-${id}`;
  const patternId = `pattern-${id}`;
  const angle = (gradient.angle * Math.PI) / 180;
  const dx = Math.cos(angle) / 2;
  const dy = Math.sin(angle) / 2;
  return (
    <svg
      viewBox={single ? `0 0 ${TILE} ${TILE}` : undefined}
      aria-hidden="true"
      focusable="false"
      className={className}
      width="100%"
      height="100%"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1={0.5 - dx}
          y1={0.5 - dy}
          x2={0.5 + dx}
          y2={0.5 + dy}
        >
          <stop stopColor={gradient.start} />
          <stop offset="1" stopColor={gradient.end} />
        </linearGradient>
        {shape !== undefined && (
          <pattern
            id={patternId}
            width={TILE}
            height={TILE}
            patternUnits="userSpaceOnUse"
          >
            <path d={shapePath(shape)} fill={`url(#${gradientId})`} />
          </pattern>
        )}
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#${shape === undefined ? gradientId : patternId})`}
      />
    </svg>
  );
}
