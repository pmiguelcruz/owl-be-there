import { isLanguage, LANGUAGE_NAMES, languagesByName } from '@owl/shared';
import { useState } from 'react';
import { LegalPage } from '../components/LegalPage.tsx';
import { Select } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { readTheme, writeTheme, type ThemeChoice } from '../lib/prefs.ts';

const SOURCES = [
  { url: 'https://github.com/pmiguelcruz/owl-be-there', name: 'Pedro’s fork' },
  { url: 'https://github.com/ni-c/owl-be-there', name: 'Original project' },
  { url: 'https://github.com/GRA0007/crab.fit', name: 'Crab Fit' },
];

export function AboutPage() {
  const { t, choice, setLanguage } = useI18n();
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const selectClass =
    'min-h-10 rounded-lg border-2 border-line bg-surface ps-3 font-bold text-ink focus:border-focus';

  return (
    <LegalPage title={t('about.title')}>
      <p className="text-lg leading-relaxed">{t('about.intro')}</p>
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-extrabold">{t('about.privacy')}</h2>
        <p>{t('about.storage')}</p>
        <p>{t('about.sharing')}</p>
        <p>{t('about.retention')}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-extrabold">{t('about.source')}</h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {SOURCES.map(({ url, name }) => (
            <li key={url}>
              <a
                href={url}
                className="inline-flex min-h-6 items-center font-bold underline underline-offset-4"
              >
                {name}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap gap-4 border-t border-line pt-4">
        <label className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center">
          <span className="font-bold">{t('footer.language')}</span>
          <Select
            className={selectClass}
            value={choice}
            onChange={(event) => {
              const language = event.target.value;
              if (isLanguage(language)) setLanguage(language);
            }}
          >
            {languagesByName().map((code) => (
              <option key={code} value={code} lang={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center">
          <span className="font-bold">{t('footer.theme')}</span>
          <Select
            className={selectClass}
            value={theme}
            onChange={(event) => {
              const next = event.target.value as ThemeChoice;
              setTheme(next);
              writeTheme(next);
            }}
          >
            <option value="system">{t('theme.system')}</option>
            <option value="light">{t('theme.light')}</option>
            <option value="dark">{t('theme.dark')}</option>
          </Select>
        </label>
      </div>
    </LegalPage>
  );
}
