import { drawPattern, type Pattern } from '@owl/shared';
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
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
});
