import type { EventThemeData } from '@owl/shared';
import { useId } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { EventWallpaper } from './EventWallpaper.tsx';
import { Button } from './ui.tsx';

type Gradient = EventThemeData['gradient'];

const COLORS = [
  '#f4696b',
  '#ef9454',
  '#cdbc44',
  '#92bd59',
  '#4bbb8b',
  '#52b9b8',
  '#54a0e5',
  '#7279d3',
  '#9a69cf',
  '#d36fb1',
];

export function randomGradients(): Gradient[] {
  const offset = Math.floor(Math.random() * COLORS.length);
  return COLORS.map((_, index) => ({
    start: COLORS[(offset + index) % COLORS.length]!,
    end: COLORS[
      (offset + index + 1 + Math.floor(Math.random() * 9)) % COLORS.length
    ]!,
    angle: Math.floor(Math.random() * 360),
  }));
}

export function randomShapes(): number[] {
  // One of each symmetry order, with independent angles, radii and corners.
  return Array.from(
    crypto.getRandomValues(new Uint32Array(5)),
    (seed, index) => (seed % 858_993_459) * 5 + index
  );
}

function Refresh({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <Button className="px-3" aria-label={label} title={label} onClick={onClick}>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5" />
      </svg>
    </Button>
  );
}

export function ThemePicker({
  gradients,
  shapes,
  gradientIndex,
  shapeIndex,
  selectGradient,
  selectShape,
  refreshGradients,
  refreshShapes,
}: {
  gradients: Gradient[];
  shapes: number[];
  gradientIndex: number;
  shapeIndex: number;
  selectGradient(index: number): void;
  selectShape(index: number): void;
  refreshGradients(): void;
  refreshShapes(): void;
}) {
  const { t } = useI18n();
  const id = useId();
  const gradient = gradients[gradientIndex]!;
  const options = [
    {
      name: 'gradient',
      title: t('theme.gradients'),
      refreshLabel: t('theme.refreshGradients'),
      refresh: refreshGradients,
      values: gradients,
      index: gradientIndex,
      select: selectGradient,
    },
    {
      name: 'shape',
      title: t('theme.shapes'),
      refreshLabel: t('theme.refreshShapes'),
      refresh: refreshShapes,
      values: shapes,
      index: shapeIndex,
      select: selectShape,
    },
  ] as const;

  return (
    <div className="grid min-w-0 gap-5 sm:grid-cols-2">
      {options.map((option) => (
        <div
          key={option.name}
          role="group"
          aria-labelledby={`${id}-${option.name}`}
          className="min-w-0 rounded-2xl border border-line bg-sunken p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span id={`${id}-${option.name}`} className="font-extrabold">
              {option.title}
            </span>
            <Refresh label={option.refreshLabel} onClick={option.refresh} />
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {option.values.map((value, index) => {
              const label = t(
                option.name === 'gradient'
                  ? 'theme.gradientOption'
                  : 'theme.shapeOption',
                { number: index + 1 }
              );
              return (
                <label
                  key={index}
                  className="relative block h-12 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={`${id}-${option.name}`}
                    aria-label={label}
                    checked={option.index === index}
                    onChange={() => option.select(index)}
                    className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <span
                    title={label}
                    className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface peer-checked:ring-2 peer-checked:ring-focus peer-checked:ring-offset-2 peer-checked:ring-offset-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus"
                  >
                    <EventWallpaper
                      gradient={typeof value === 'number' ? gradient : value}
                      {...(typeof value === 'number' && { shape: value })}
                      single={typeof value === 'number'}
                      className="size-full"
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="overflow-hidden rounded-2xl border border-line bg-bg sm:col-span-2">
        <span className="sr-only">{t('theme.preview')}</span>
        <EventWallpaper
          gradient={gradient}
          shape={shapes[shapeIndex]!}
          className="block h-28 w-full"
        />
      </div>
    </div>
  );
}
