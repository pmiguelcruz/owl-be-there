import { patternBatch, type Pattern } from '@owl/shared';
import { useId } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { wallpaperPaletteStyle } from '../lib/wallpaperPalette.ts';
import { EventWallpaper } from './EventWallpaper.tsx';
import { Button } from './ui.tsx';

export function randomPatterns(previous: readonly Pattern[] = []): Pattern[] {
  const words = new Uint32Array(1);
  return patternBatch(() => crypto.getRandomValues(words)[0]!, previous);
}

export function samePattern(a: Pattern, b: Pattern): boolean {
  return a.kind === b.kind && a.seed === b.seed && a.wild === b.wild;
}

export function PatternPicker({
  selected,
  choices,
  onRefresh,
  onSelect,
  hideLabel = false,
}: {
  selected: Pattern;
  choices: Pattern[];
  onRefresh(): void;
  onSelect(pattern: Pattern): void;
  hideLabel?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const refreshLabel = t('theme.refreshPatterns');

  return (
    <div
      role="group"
      aria-labelledby={id}
      data-wallpaper-palette
      style={wallpaperPaletteStyle(selected)}
      className="min-w-0 rounded-2xl border border-line bg-surface p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span id={id} className={hideLabel ? 'sr-only' : 'font-extrabold'}>
          {t('theme.pattern')}
        </span>
        <Button
          className="ms-auto px-3"
          aria-label={refreshLabel}
          title={refreshLabel}
          onClick={onRefresh}
        >
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
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {choices.map((pattern, index) => {
          const label = t(
            pattern.wild ? 'theme.wildPatternOption' : 'theme.patternOption',
            { number: index + 1 }
          );
          return (
            <label key={pattern.kind} className="relative block cursor-pointer">
              <input
                type="radio"
                name={id}
                aria-label={label}
                checked={samePattern(selected, pattern)}
                onChange={() => onSelect(pattern)}
                className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0"
              />
              <span
                title={label}
                className="block h-16 overflow-hidden rounded-lg border border-line peer-checked:ring-2 peer-checked:ring-focus peer-checked:ring-offset-2 peer-checked:ring-offset-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus sm:h-20"
              >
                <EventWallpaper
                  pattern={pattern}
                  className="block size-full"
                  preview
                />
              </span>
            </label>
          );
        })}
      </div>
      <figure className="mt-4 overflow-hidden rounded-xl border border-line">
        <figcaption className="sr-only">{t('theme.preview')}</figcaption>
        <EventWallpaper
          pattern={selected}
          className="block h-24 w-full"
          preview
        />
      </figure>
    </div>
  );
}
