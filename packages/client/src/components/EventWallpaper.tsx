import { drawPattern, type Pattern } from '@owl/shared';
import { useId } from 'react';

export function EventWallpaper({
  pattern,
  className,
  preview = false,
}: {
  pattern: Pattern;
  className: string;
  preview?: boolean;
}) {
  const id = useId();
  const { width, height, marks, palette, texture, weight } =
    drawPattern(pattern);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width="100%"
      height="100%"
      data-wallpaper={preview ? 'preview' : 'event'}
      data-pattern={`${pattern.kind}:${pattern.seed}`}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternTransform={preview ? 'scale(.64)' : undefined}
        >
          {marks.map(({ d, tone, fill }, index) => (
            <path
              key={index}
              d={d}
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
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={palette.base} />
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
