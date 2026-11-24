import type { EventDirectoryData } from '@owl/shared';
import { EventList } from '../components/EventList.tsx';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CreateWizard } from '../components/CreateWizard.tsx';
import { Button, Card, Field, Notice, TextInput } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { ApiFailure, api } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';

export function AdminPage({
  session,
  setSession,
  creationEnabled,
}: {
  session: string | null;
  setSession(session: string | null): void;
  creationEnabled: boolean;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directory, setDirectory] = useState<{
    token: string;
    events: EventDirectoryData;
  } | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  useEffect(() => {
    if (!session || creating) return;
    let active = true;
    void api.adminEvents(session).then(
      (events) => {
        if (active) {
          setDirectory({ token: session, events });
          setDirectoryError(null);
        }
      },
      (failure) => {
        if (!active) return;
        if (failure instanceof ApiFailure && failure.status === 403)
          setSession(null);
        else setDirectoryError(errorMessage(failure, t));
      }
    );
    return () => {
      active = false;
    };
  }, [session, creating, setSession, t]);

  const focusStart = useRef(false);
  const start = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session && !creating && focusStart.current) {
      focusStart.current = false;
      start.current?.focus();
    }
  }, [creating, session]);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    focusStart.current = true;
    try {
      const { token } = await api.unlockAdmin(pin);
      setSession(token);
    } catch (problem) {
      setError(
        problem instanceof ApiFailure && problem.code === 'invalid_pin'
          ? t('admin.incorrect')
          : problem instanceof ApiFailure && problem.code === 'admin_disabled'
            ? t('siteAdmin.unavailable')
            : errorMessage(problem, t)
      );
      requestAnimationFrame(() => input.current?.focus());
    } finally {
      setPin('');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 py-4">
      <h1 className="self-start rounded-xl bg-surface px-3 py-2 text-3xl font-black">
        {t('siteAdmin.title')}
      </h1>
      {!session && (
        <Card className="max-w-md">
          <form
            onSubmit={(event) => void unlock(event)}
            className="flex flex-col gap-4"
          >
            <Field label={t('admin.pin')} error={error}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  ref={input}
                  id={id}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  autoComplete="off"
                  required
                  maxLength={4}
                  value={pin}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  onChange={(event) => setPin(event.target.value)}
                  disabled={submitting}
                />
              )}
            </Field>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="self-start"
            >
              {t('admin.unlock')}
            </Button>
          </form>
        </Card>
      )}
      {session && !creating && (
        <div className="flex flex-wrap gap-3">
          <Button
            ref={start}
            disabled={!creationEnabled}
            variant="primary"
            onClick={() => setCreating(true)}
          >
            {t('home.cta')}
          </Button>
          <Button
            onClick={() => {
              setSession(null);
              void api.lockAdmin(session).catch(() => undefined);
              requestAnimationFrame(() => input.current?.focus());
            }}
          >
            {t('admin.lock')}
          </Button>
        </div>
      )}
      {session && !creating && directoryError && (
        <Notice tone="error">{directoryError}</Notice>
      )}
      {session &&
        !creating &&
        directory?.token === session &&
        (directory.events.length ? (
          <EventList events={directory.events} admin />
        ) : (
          <p className="self-start rounded-xl bg-surface px-3 py-2 text-muted">
            {t('siteAdmin.noEvents')}
          </p>
        ))}
      {creating && (
        <div hidden={!session}>
          <CreateWizard
            token={session}
            onLocked={() => {
              setSession(null);
              setError(t('admin.expired'));
              requestAnimationFrame(() => input.current?.focus());
            }}
            onCancel={() => {
              focusStart.current = true;
              setCreating(false);
            }}
          />
        </div>
      )}
      {!session && submitting && <Notice>{t('admin.checking')}</Notice>}
    </div>
  );
}
