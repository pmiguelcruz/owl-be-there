import { drawPattern, wallpaperLight, type Pattern } from '@owl/shared';
import { memo, useId } from 'react';

export const EventWallpaper = memo(function EventWallpaper({
  pattern,
  className,
  preview = false,
}: {
  pattern: Pattern;
  className: string;
  preview?: boolean;
}) {
  const id = useId();
  const flow = `${id}-flow`;
  const lights = wallpaperLight(pattern.seed);
  const { width, height, marks, palette, spacing, texture, weight } =
    drawPattern(pattern);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width="100%"
      height="100%"
      data-wallpaper={preview ? 'preview' : 'event'}
      data-spacing={spacing}
      data-pattern={`${pattern.kind}:${pattern.seed}`}
    >
      <defs>
        {lights.map(({ tone, x, y, radius, angle, squash, opacity }) => (
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
        ))}
        <filter
          id={flow}
          filterUnits="userSpaceOnUse"
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency={preview ? '.013 .017' : '.0037 .0046'}
            numOctaves="1"
            seed={1 + (pattern.seed % 1009)}
            result="space"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="space"
            scale={preview ? 28 : 108}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternTransform="scale(.5)"
        >
          <g opacity={spacing === 'packed' ? '0.18' : '0.27'}>
            {marks.map(({ d, tone, fill, transform }, index) => (
              <path
                key={index}
                d={d}
                transform={transform}
                fillRule="evenodd"
                fill={fill ? palette[tone] : 'none'}
                stroke={fill ? undefined : palette[tone]}
                strokeWidth={fill ? undefined : weight}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {texture && (
              <path
                d={texture}
                fill="none"
                stroke={palette.base}
                strokeWidth=".65"
              />
            )}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={palette.base} />
      {lights.map(({ tone }) => (
        <rect
          key={tone}
          width="100%"
          height="100%"
          fill={`url(#${id}-${tone})`}
        />
      ))}
      <rect
        x="-8%"
        y="-8%"
        width="116%"
        height="116%"
        fill={`url(#${id})`}
        filter={`url(#${flow})`}
      />
    </svg>
  );
});
