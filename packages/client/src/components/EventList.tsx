import type { EventDirectoryData } from '@owl/shared';
import { Link } from '../App.tsx';
import { useI18n } from '../i18n/index.tsx';

export function EventList({
  events,
  admin = false,
}: {
  events: EventDirectoryData;
  admin?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ul
      aria-label={t(admin ? 'siteAdmin.events' : 'home.myEvents')}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`${admin ? '/admin/events' : '/e'}/${event.id}`}
            className="flex min-h-14 items-center rounded-3xl border border-line bg-surface px-4 py-2 font-bold shadow-card hover:border-line-strong"
          >
            <span className="min-w-0 break-words" dir="auto">
              {event.title}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
