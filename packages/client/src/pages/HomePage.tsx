import { useRef, useState } from 'react';
import { Link } from '../App.tsx';
import { CloseIcon } from '../components/icons.tsx';
import { Button, Dialog } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { isolate } from '../lib/bidi.ts';
import { forgetEvent, readMyEvents, type MyEvent } from '../lib/prefs.ts';

export function HomePage() {
  const { t } = useI18n();
  const [myEvents, setMyEvents] = useState<MyEvent[]>(readMyEvents);
  const [forgetting, setForgetting] = useState<MyEvent | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const forgottenAt = useRef(0);

  const forget = (event: MyEvent) => {
    forgottenAt.current = myEvents.findIndex((mine) => mine.id === event.id);
    forgetEvent(event.id);
    setMyEvents(readMyEvents());
    // A one-tap removal has no dialog to return focus: land on the neighbour.
    if (event.role !== 'organiser') {
      requestAnimationFrame(() =>
        (afterForget() ?? document.querySelector<HTMLElement>('main'))?.focus()
      );
    }
  };

  // The opener is gone: the entry that took its place, else the last one.
  const afterForget = () => {
    const links = listRef.current?.querySelectorAll<HTMLElement>('li > a');
    return links?.item(Math.min(forgottenAt.current, links.length - 1)) ?? null;
  };

  return (
    <>
      {myEvents.length > 0 && (
        <ul
          aria-label={t('home.myEvents')}
          ref={listRef}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {myEvents.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-2 rounded-3xl border border-line bg-surface p-2 ps-4 shadow-card"
            >
              <Link
                href={`/e/${event.id}`}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 font-bold"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="break-words" dir="auto">
                    {event.title}
                  </span>
                  {event.role === 'organiser' && (
                    <span className="text-sm font-semibold text-muted">
                      {t('home.organiser')}
                    </span>
                  )}
                </span>
              </Link>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
                aria-label={t('home.forget', { title: event.title })}
                onClick={() =>
                  event.role === 'organiser'
                    ? setForgetting(event)
                    : forget(event)
                }
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={forgetting !== null}
        onClose={() => setForgetting(null)}
        title={t('home.forgetOrganiser.title')}
        returnFocus={afterForget}
      >
        <div className="flex flex-col gap-5">
          <p className="leading-relaxed break-words">
            {forgetting &&
              t('home.forgetOrganiser.text', {
                title: isolate(forgetting.title),
              })}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setForgetting(null)}>
              {t('mine.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (forgetting) forget(forgetting);
                setForgetting(null);
              }}
            >
              {t('home.forgetOrganiser.yes')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
