import { lookBatch, type WallpaperLook } from '@owl/shared';
import { useId } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { wallpaperPaletteStyle } from '../lib/wallpaperPalette.ts';
import { EventWallpaper } from './EventWallpaper.tsx';
import { Button } from './ui.tsx';

export function randomLooks(
  previous: readonly WallpaperLook[] = []
): WallpaperLook[] {
  const words = new Uint32Array(1);
  return lookBatch(() => crypto.getRandomValues(words)[0]!, previous);
}

export function sameLook(a: WallpaperLook, b: WallpaperLook): boolean {
  return (
    a.kind === b.kind &&
    a.seed === b.seed &&
    a.wild === b.wild &&
    (a.gradient ?? 'flow') === (b.gradient ?? 'flow')
  );
}

export function LookPicker({
  selected,
  choices,
  onRefresh,
  onSelect,
  hideLabel = false,
}: {
  selected: WallpaperLook;
  choices: WallpaperLook[];
  onRefresh(): void;
  onSelect(look: WallpaperLook): void;
  hideLabel?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const refreshLabel = t('theme.refreshLooks');

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
          {t('theme.look')}
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
        {choices.map((look, index) => {
          const label = t(
            look.wild ? 'theme.wildLookOption' : 'theme.lookOption',
            { number: index + 1 }
          );
          return (
            <label key={look.seed} className="relative block cursor-pointer">
              <input
                type="radio"
                name={id}
                aria-label={label}
                checked={sameLook(selected, look)}
                onChange={() => onSelect(look)}
                className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0"
              />
              <span
                title={label}
                className="block h-16 overflow-hidden rounded-lg border border-line peer-checked:ring-2 peer-checked:ring-focus peer-checked:ring-offset-2 peer-checked:ring-offset-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus sm:h-20"
              >
                <EventWallpaper
                  look={look}
                  className="block size-full"
                  surface="preview"
                />
              </span>
            </label>
          );
        })}
      </div>
      <figure className="mt-4 overflow-hidden rounded-xl border border-line">
        <figcaption className="sr-only">{t('theme.preview')}</figcaption>
        <EventWallpaper
          look={selected}
          className="block h-24 w-full"
          surface="preview"
        />
      </figure>
    </div>
  );
}
