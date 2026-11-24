import {
  APP_NAME,
  formatDayRange,
  googleCalendarUrl,
  patternFor,
  type EventSnapshotData,
  type Pattern,
} from '@owl/shared';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AdminPanel } from '../components/AdminPanel.tsx';
import { EventViews, type EventTab } from '../components/EventViews.tsx';
import { GroupView } from '../components/GroupView.tsx';
import {
  CalendarIcon,
  ClockIcon,
  PinIcon,
  ShareIcon,
  UserIcon,
  UsersIcon,
} from '../components/icons.tsx';
import { MyDays } from '../components/MyDays.tsx';
import { EventWallpaper } from '../components/EventWallpaper.tsx';
import { ShareDialog } from '../components/ShareDialog.tsx';
import { Button, Card, Notice } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { calendarFileUrl } from '../lib/api.ts';
import { OWL_ICON, setFavicon } from '../lib/favicon.ts';
import { isolate } from '../lib/bidi.ts';
import { scrollToTop } from '../lib/motion.ts';
import { useToday } from '../hooks/useToday.ts';
import { useEventStore } from '../hooks/useEventStore.ts';
import type { EventStore } from '../lib/eventStore.ts';
import { firstWeekdayFor } from '../lib/locale.ts';
import { eventLink } from '../lib/links.ts';
import { readSession, storeSession, type Session } from '../lib/prefs.ts';

/** The look of the calendar-file and Google links under a decided event. */
const RAISED_PILL =
  'inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 font-bold shadow-card';

const noop = () => {};

export function EventPage({
  id,
  publicUrl,
  adminToken = null,
  onPattern,
  onAdminLost = noop,
}: {
  id: string;
  publicUrl: string | null;
  adminToken?: string | null;
  onPattern(pattern: Pattern | null): void;
  onAdminLost?(): void;
}) {
  const { t } = useI18n();
  const { store, state } = useEventStore(id, adminToken, onAdminLost);
  const [session, setSession] = useState<Session | null>(() => readSession(id));
  const changeSession = useCallback(
    (next: Session | null) => {
      const changed = readSession(id)?.token !== next?.token;
      storeSession(id, next);
      setSession(next);
      if (changed) store.refreshIdentity();
    },
    [id, store]
  );

  useEffect(() => {
    // Links issued by older versions may still carry a retired organizer key.
    const strip = () => {
      if (location.hash.startsWith('#admin=')) {
        history.replaceState(
          history.state,
          '',
          location.pathname + location.search
        );
      }
    };
    strip();
    window.addEventListener('hashchange', strip);
    return () => window.removeEventListener('hashchange', strip);
  }, []);
  const [shareOpen, setShareOpen] = useState(() =>
    Boolean((window.history.state as { created?: boolean } | null)?.created)
  );
  const [justCreated, setJustCreated] = useState(shareOpen);

  useEffect(() => {
    if (justCreated)
      window.history.replaceState(null, '', window.location.pathname);
  }, [justCreated]);

  // Keep the title and favicon in step with the loaded event.
  const loaded = state.status === 'ready' ? state.data.event : null;
  const theme = loaded?.theme;
  const pattern = useMemo(() => patternFor(id, theme), [id, theme]);
  const hasEvent = loaded !== null;
  useLayoutEffect(() => {
    if (!hasEvent) return;
    onPattern(pattern);
    return () => onPattern(null);
  }, [hasEvent, onPattern, pattern]);
  useEffect(() => {
    setFavicon(OWL_ICON);
    if (loaded) {
      document.title = `${loaded.title} · ${APP_NAME}`;
    } else {
      // Not the title of the page this one replaced.
      document.title = `${APP_NAME} — ${t('app.tagline')}`;
    }
  }, [loaded, t]);

  // A removed event no longer needs a participant session.
  const gone = state.status === 'not-found' || state.status === 'deleted';
  useEffect(() => {
    if (!gone) return;
    storeSession(id, null);
    // The emoji of an event that is no more would stay in the tab.
    setFavicon(OWL_ICON);
  }, [gone, id]);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-20" role="status">
        <p className="font-bold text-muted">{t('event.loading')}</p>
      </div>
    );
  }
  if (
    state.status === 'not-found' ||
    state.status === 'deleted' ||
    state.status === 'error'
  ) {
    return <EndState status={state.status} />;
  }

  return (
    <EventView
      data={state.data}
      pattern={pattern}
      stale={state.stale}
      store={store}
      adminToken={adminToken}
      onAdminLost={onAdminLost}
      session={session}
      onSession={changeSession}
      shareOpen={shareOpen}
      onShare={(open) => {
        setShareOpen(open);
        // The greeting is for the first look at the dialog only.
        if (!open) setJustCreated(false);
      }}
      justCreated={justCreated}
      publicUrl={publicUrl}
    />
  );
}

interface EventViewProps {
  data: EventSnapshotData;
  pattern: Pattern;
  stale: boolean;
  store: EventStore;
  adminToken: string | null;
  onAdminLost(): void;
  session: Session | null;
  onSession(session: Session | null): void;
  shareOpen: boolean;
  onShare(open: boolean): void;
  justCreated: boolean;
  publicUrl: string | null;
}

/** The page that replaces the event; focused, so it is read out when it appears. */
function EndState({ status }: { status: 'not-found' | 'deleted' | 'error' }) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [status]);
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-black">
        {status === 'deleted'
          ? t('event.deleted')
          : status === 'error'
            ? t('error.generic')
            : t('event.notFound.title')}
      </h1>
      {status === 'not-found' && (
        <p className="max-w-lg text-muted">{t('event.notFound.text')}</p>
      )}
    </div>
  );
}

function EventView(props: EventViewProps) {
  const { data, stale, store, adminToken, session, onSession } = props;
  const { t } = useI18n();
  const [tab, setTab] = useState<EventTab>('mine');
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const firstWeekday = useMemo(() => firstWeekdayFor(navigator.language), []);
  const today = useToday();
  const { event } = data;
  const answered = data.participants.filter((p) => p.answered).length;
  const shared = {
    data,
    store,
    adminToken,
    firstWeekday,
    today,
  };

  const mine = (
    <MyDays
      {...shared}
      session={session}
      onSession={onSession}
      editingFor={editingFor}
      onStopEditing={() => setEditingFor(null)}
    />
  );
  const group = <GroupView {...shared} onAdminLost={props.onAdminLost} />;

  return (
    <div className="flex flex-col gap-5">
      <EventWallpaper
        pattern={props.pattern}
        className="pointer-events-none fixed inset-0 -z-10"
      />
      <EventHeader
        data={data}
        onShare={adminToken ? () => props.onShare(true) : undefined}
      />
      {stale && <Notice>{t('event.stale')}</Notice>}
      <StatusBanner data={data} publicUrl={props.publicUrl} />

      {adminToken ? (
        <EventViews
          mine={mine}
          group={group}
          answered={answered}
          tab={tab}
          onTab={setTab}
        />
      ) : (
        <Card>
          <h2 className="mb-4 text-xl font-extrabold">{t('event.tabMine')}</h2>
          {mine}
        </Card>
      )}

      {adminToken && (
        <AdminPanel
          data={data}
          store={store}
          adminToken={adminToken}
          onAdminLost={props.onAdminLost}
          firstWeekday={firstWeekday}
          today={today}
          onFillIn={(participantId) => {
            setEditingFor(participantId);
            setTab('mine');
            scrollToTop();
          }}
        />
      )}

      {adminToken && (
        <ShareDialog
          open={props.shareOpen}
          onClose={() => props.onShare(false)}
          event={event}
          justCreated={props.justCreated}
          publicUrl={props.publicUrl}
        />
      )}
    </div>
  );
}

function EventHeader({
  data,
  onShare,
}: {
  data: EventSnapshotData;
  onShare: (() => void) | undefined;
}) {
  const { t, tn } = useI18n();
  const { event } = data;
  const meta = [
    event.location && {
      icon: <PinIcon size={16} />,
      text: event.location,
      user: true,
    },
    event.creatorName && {
      icon: <UserIcon size={16} />,
      text: t('event.organisedBy', { name: isolate(event.creatorName) }),
    },
    event.durationDays > 1 && {
      icon: <ClockIcon size={16} />,
      text: tn('event.duration', event.durationDays),
    },
    event.minCount !== null && {
      icon: <UsersIcon size={16} />,
      text: tn('event.minCount', event.minCount),
    },
  ].filter(Boolean) as { icon: ReactNode; text: string; user?: boolean }[];
  return (
    <header className="event-intro flex flex-col gap-3 rounded-3xl border border-line px-4 py-3 shadow-card sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h1 className="flex max-w-full min-w-0 flex-auto items-start gap-3 text-3xl leading-tight font-black sm:text-4xl">
          <span dir="auto" className="min-w-0 break-words">
            {event.title}
          </span>
        </h1>
        {onShare && (
          <Button
            variant="primary"
            onClick={onShare}
            className="ms-auto shrink-0"
          >
            <ShareIcon />
            <span>{t('event.share')}</span>
          </Button>
        )}
      </div>
      {meta.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {meta.map((item) => (
            <li
              key={item.text}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-sunken px-3 py-1 text-sm font-bold break-words"
            >
              {item.icon}
              {item.user ? <bdi>{item.text}</bdi> : item.text}
            </li>
          ))}
        </ul>
      )}
      {event.description && (
        // Plain text on purpose: nothing an organiser writes becomes a link.
        <p
          dir="auto"
          className="leading-relaxed break-words whitespace-pre-line text-muted"
        >
          {event.description}
        </p>
      )}
    </header>
  );
}

function StatusBanner({
  data,
  publicUrl,
}: {
  data: EventSnapshotData;
  publicUrl: string | null;
}) {
  const { t, locale } = useI18n();
  const { event } = data;
  if (event.status === 'open') return null;
  if (event.status === 'closed' || !event.finalStart || !event.finalEnd) {
    return <Notice>{t('event.closed')}</Notice>;
  }
  const when = formatDayRange(event.finalStart, event.finalEnd, locale);
  const google = googleCalendarUrl({
    title: event.title,
    description: event.description,
    location: event.location,
    start: event.finalStart,
    end: event.finalEnd,
    url: eventLink(publicUrl, event.id, window.location.origin),
  });
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border-2 border-brand bg-brand-soft p-5 text-center sm:flex-row sm:text-start">
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-base font-black text-muted">{t('event.decided')}</p>
        <p className="text-2xl font-black">{when}</p>
      </div>
      <div
        className="flex flex-wrap justify-center gap-2"
        aria-label={t('event.addToCalendar')}
        role="group"
      >
        <a
          href={calendarFileUrl(event.id)}
          download="owl-be-there.ics"
          className={RAISED_PILL}
        >
          <CalendarIcon /> {t('event.icsFile')}
        </a>
        <a
          href={google}
          target="_blank"
          rel="noopener noreferrer"
          className={RAISED_PILL}
        >
          {t('event.google')}
        </a>
      </div>
    </section>
  );
}
