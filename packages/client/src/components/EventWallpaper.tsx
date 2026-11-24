import {
  lookPalette,
  wallpaperGradient,
  type WallpaperLook,
} from '@owl/shared';
import { memo, useId } from 'react';

export const EventWallpaper = memo(function EventWallpaper({
  look,
  className,
  surface = 'event',
}: {
  look: WallpaperLook;
  className: string;
  surface?: 'event' | 'home' | 'site' | 'preview';
}) {
  const id = useId();
  const palette = lookPalette(look);
  const gradient = wallpaperGradient(look);

  return (
    <div
      aria-hidden="true"
      className={`${surface === 'preview' ? 'relative' : ''} isolate ${className}`}
      data-wallpaper={surface}
      data-gradient={gradient.style}
      data-wild={look.wild}
      data-look={`${look.seed}:${gradient.style}${look.wild ? ':wild' : ''}`}
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
                stopOpacity={look.wild ? '.96' : '.76'}
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
                stopOpacity={look.wild ? '.84' : '.57'}
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
    </div>
  );
});
