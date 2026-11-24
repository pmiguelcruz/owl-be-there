import type { EventDirectoryData } from '@owl/shared';
import { useEffect, useState } from 'react';
import { EventList } from '../components/EventList.tsx';
import { Notice } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { api } from '../lib/api.ts';
import { clearLegacyVisits, legacyVisitIds } from '../lib/prefs.ts';

async function visited(): Promise<EventDirectoryData> {
  const previous = legacyVisitIds();
  if (previous.length > 0) {
    await api.importVisits(previous);
    clearLegacyVisits();
  }
  return api.visitedEvents();
}

export function HomePage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<EventDirectoryData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      void visited().then(
        (list) => {
          if (active) {
            setEvents(list);
            setError(false);
          }
        },
        () => {
          if (active) setError(true);
        }
      );
    load();
    window.addEventListener('pageshow', load);
    return () => {
      active = false;
      window.removeEventListener('pageshow', load);
    };
  }, []);
  if (error) return <Notice tone="error">{t('home.eventsUnavailable')}</Notice>;
  if (!events) return null;
  if (!events.length) return <p className="text-muted">{t('home.noEvents')}</p>;
  return <EventList events={events} />;
}
