import { drawPattern, wallpaperGradient, type Pattern } from '@owl/shared';
import { memo, useId, useLayoutEffect, useMemo, useRef } from 'react';
import {
  paintWallpaperMarks,
  WALLPAPER_REPEAT_SCALE,
} from '../lib/wallpaperMarks.ts';

export const EventWallpaper = memo(function EventWallpaper({
  pattern,
  className,
  surface = 'event',
}: {
  pattern: Pattern;
  className: string;
  surface?: 'event' | 'home' | 'preview';
}) {
  const id = useId();
  const marks = useRef<HTMLCanvasElement>(null);
  const tile = useMemo(() => drawPattern(pattern), [pattern]);
  const gradient = useMemo(() => wallpaperGradient(pattern), [pattern]);
  const { palette, spacing } = tile;
  const markOpacity = pattern.wild ? 0.46 : spacing === 'packed' ? 0.22 : 0.32;

  useLayoutEffect(() => {
    const canvas = marks.current!;
    let previousWidth = 0;
    let previousHeight = 0;
    const paint = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === previousWidth && height === previousHeight) return;
      previousWidth = width;
      previousHeight = height;
      paintWallpaperMarks(canvas, tile, gradient, width, height);
    };
    paint();
    const resize = new ResizeObserver(paint);
    resize.observe(canvas);
    return () => resize.disconnect();
  }, [tile, gradient]);

  return (
    <div
      aria-hidden="true"
      className={`${surface === 'preview' ? 'relative' : ''} isolate ${className}`}
      data-wallpaper={surface}
      data-gradient={gradient.style}
      data-repeat-scale={WALLPAPER_REPEAT_SCALE}
      data-spacing={spacing}
      data-wild={pattern.wild}
      data-pattern={`${pattern.kind}:${pattern.seed}${pattern.wild ? ':wild' : ''}`}
    >
      <svg className="absolute inset-0 size-full" focusable="false">
        <defs>
          {gradient.style === 'linear' && (
            <linearGradient
              id={id}
              x1={gradient.from[0]}
              y1={gradient.from[1]}
              x2={gradient.to[0]}
              y2={gradient.to[1]}
            >
              <stop stopColor={palette.base} />
              <stop offset=".23" stopColor={palette.ink} />
              <stop
                offset=".54"
                stopColor={palette.accent}
                stopOpacity={pattern.wild ? '.96' : '.76'}
              />
              <stop offset=".76" stopColor={palette.thread} stopOpacity=".64" />
              <stop offset="1" stopColor={palette.base} />
            </linearGradient>
          )}
          {gradient.style === 'radial' && (
            <radialGradient
              id={id}
              cx={gradient.center[0]}
              cy={gradient.center[1]}
              r={gradient.radius}
            >
              <stop
                stopColor={palette.highlight}
                stopOpacity={pattern.wild ? '.84' : '.57'}
              />
              <stop offset=".29" stopColor={palette.accent} stopOpacity=".84" />
              <stop offset=".56" stopColor={palette.thread} stopOpacity=".55" />
              <stop offset=".84" stopColor={palette.ink} stopOpacity=".68" />
              <stop offset="1" stopColor={palette.base} />
            </radialGradient>
          )}
          {gradient.style === 'flow' &&
            gradient.lights.map(
              ({ tone, x, y, radius, angle, squash, opacity }) => (
                <radialGradient
                  key={tone}
                  id={`${id}-${tone}`}
                  cx={x}
                  cy={y}
                  r={radius}
                  gradientTransform={`translate(${x} ${y}) rotate(${angle}) scale(1 ${squash}) translate(${-x} ${-y})`}
                >
                  <stop stopColor={palette[tone]} stopOpacity={opacity} />
                  <stop
                    offset=".37"
                    stopColor={palette[tone]}
                    stopOpacity={opacity * 0.64}
                  />
                  <stop
                    offset=".77"
                    stopColor={palette[tone]}
                    stopOpacity={opacity * 0.17}
                  />
                  <stop offset="1" stopColor={palette[tone]} stopOpacity="0" />
                </radialGradient>
              )
            )}
        </defs>
        <rect width="100%" height="100%" fill={palette.base} />
        {gradient.style === 'flow' ? (
          gradient.lights.map(({ tone }) => (
            <rect
              key={tone}
              width="100%"
              height="100%"
              fill={`url(#${id}-${tone})`}
            />
          ))
        ) : (
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        )}
      </svg>
      <canvas
        ref={marks}
        className="absolute inset-0 size-full"
        style={{ opacity: markOpacity }}
      />
    </div>
  );
});
