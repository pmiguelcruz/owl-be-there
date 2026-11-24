import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CreateWizard } from '../components/CreateWizard.tsx';
import { Button, Card, Field, Notice, TextInput } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { ApiFailure, api } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';

export function AdminPage({
  session,
  setSession,
}: {
  session: string | null;
  setSession(session: string | null): void;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          : problem instanceof ApiFailure &&
              problem.code === 'creation_disabled'
            ? t('home.creationDisabled')
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
      <h1 className="text-3xl font-black">{t('siteAdmin.title')}</h1>
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
            variant="primary"
            onClick={() => setCreating(true)}
          >
            {t('home.cta')}
          </Button>
          <Button
            onClick={() => {
              setSession(null);
              requestAnimationFrame(() => input.current?.focus());
            }}
          >
            {t('admin.lock')}
          </Button>
        </div>
      )}
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
