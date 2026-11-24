import {
  addDays,
  compareISODate,
  expandRange,
  forgetChangedWeekdays,
  isValidISODate,
  keepChosenDays,
  LIMITS,
  todayLocal,
  type ISODate,
  type Mark,
  type Weekday,
} from '@owl/shared';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { ApiFailure, api } from '../lib/api.ts';
import { daysProblem, rangeProblemKey, type Problem } from '../lib/dayEdit.ts';
import { createErrorMessage } from '../lib/errors.ts';
import {
  asciiDigits,
  checkMinCount,
  checkTitle,
  invisibleProblem,
  parseRoster,
} from '../lib/forms.ts';
import { firstWeekdayFor, weekdayName, weekdayOrder } from '../lib/locale.ts';
import { navigate } from '../lib/route.ts';
import { holdReload } from '../lib/reloadGuard.ts';
import { LookPicker, randomLooks } from './LookPicker.tsx';
import { CalendarGrid } from './CalendarGrid.tsx';
import { Button, Card, Field, Notice, TextArea, TextInput } from './ui.tsx';

const STEPS = 3;
const STEP_NUMBERS = Array.from({ length: STEPS }, (_, i) => i + 1);

/**
 * Three steps: what, when, who. The days are chosen as a range and a set of
 * weekdays, then fine-tuned by painting in the same calendar the participants
 * will use — so the organiser has used it once before sending the link.
 */
export function CreateWizard({
  token,
  onCancel,
  onLocked,
}: {
  token: string | null;
  onCancel(): void;
  onLocked(): void;
}) {
  const { t, tn, number, language, locale } = useI18n();
  const today = todayLocal();
  const firstWeekday = useMemo(() => firstWeekdayFor(navigator.language), []);

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [looks, setLooks] = useState(randomLooks);
  const [look, setLook] = useState(looks[0]!);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [from, setFrom] = useState(addDays(today, 1));
  const [to, setTo] = useState(addDays(today, 28));
  const [weekdays, setWeekdays] = useState<Set<Weekday>>(new Set());
  const [manual, setManual] = useState<{
    chosen: ReadonlySet<ISODate>;
    seen: ReadonlySet<ISODate>;
  } | null>(null);
  const [duration, setDuration] = useState(1);
  const [roster, setRoster] = useState('');
  const [minCount, setMinCount] = useState('');
  // The steps the organiser has tried to leave: their problems show from then
  // on and follow the input, so a fixed field loses its message at once.
  const [tried, setTried] = useState<ReadonlySet<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const legendRef = useRef<HTMLLegendElement>(null);

  // A language reload would lose what has been typed so far.
  useEffect(
    () =>
      holdReload(() => [title, description, location, roster].some(Boolean)),
    [title, description, location, roster]
  );

  // A new step starts at its heading, which also tells a screen reader.
  useEffect(() => {
    if (!token) return;
    legendRef.current?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ block: 'start' });
  }, [step, token]);

  const rangeProblem = useMemo(() => {
    const key = rangeProblemKey(from, to, today);
    return key && t(key);
  }, [from, to, today, t]);

  const rangeDays = useMemo(
    () => (rangeProblem ? [] : expandRange(from, to)),
    [from, to, rangeProblem]
  );
  const automatic = useMemo(
    () => (rangeProblem ? [] : expandRange(from, to, weekdays)),
    [from, to, weekdays, rangeProblem]
  );
  const marks = useMemo(() => {
    const days = manual
      ? keepChosenDays(
          rangeDays,
          new Set(automatic),
          manual.chosen,
          manual.seen
        )
      : automatic;
    return new Map(days.map((day) => [day, 'yes' as Mark]));
  }, [manual, rangeDays, automatic]);
  const candidates = useMemo(() => [...marks.keys()].sort(), [marks]);

  const dayProblem = (): string | null => {
    if (rangeProblem) return rangeProblem;
    const problem = daysProblem(candidates, duration);
    return problem && t(problem.key, problem.params);
  };
  const minCountProblem = checkMinCount(minCount).problem;
  const parsedRoster = parseRoster(roster);
  const text = (problem: Problem | null) =>
    problem && t(problem.key, problem.params);

  const titleProblem = checkTitle(title);
  const locationProblem = invisibleProblem(location);
  const creatorProblem = invisibleProblem(creatorName);
  const titleError = tried.has(1) ? text(titleProblem) : null;
  const locationError = tried.has(1) ? text(locationProblem) : null;
  const creatorError = tried.has(1) ? text(creatorProblem) : null;
  const daysError = tried.has(2) ? dayProblem() : rangeProblem;
  const minCountError = tried.has(3) ? text(minCountProblem) : null;
  const rosterError = tried.has(3) ? text(parsedRoster.problem) : null;

  const validate = (which: number): boolean => {
    setTried((current) => new Set(current).add(which));
    if (which === 1)
      return (
        titleProblem === null &&
        locationProblem === null &&
        creatorProblem === null
      );
    if (which === 2) return dayProblem() === null;
    return minCountProblem === null && parsedRoster.problem === null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < STEPS) {
      if (validate(step)) setStep(step + 1);
      return;
    }
    if (!token || submitting || !validate(1) || !validate(2) || !validate(3))
      return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const names = parsedRoster.names;
      const created = await api.createEvent(
        {
          title,
          theme: { version: 1, pattern: look },
          language,
          durationDays: duration,
          days: candidates,
          ...(description.trim() && { description }),
          ...(location.trim() && { location }),
          ...(creatorName.trim() && { creatorName }),
          ...(minCount.trim() && { minCount: Number(minCount) }),
          ...(names.length > 0 && { roster: names }),
        },
        token
      );
      navigate(`/admin/events/${created.id}`, { state: { created: true } });
    } catch (error) {
      if (error instanceof ApiFailure && error.code === 'creation_locked') {
        onLocked();
      } else {
        setSubmitError(createErrorMessage(error, t, { count: duration }));
      }
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <form
        ref={formRef}
        onSubmit={(event) => void submit(event)}
        noValidate
        className="flex flex-col gap-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-black">{t('create.title')}</h2>
          <p className="font-bold text-muted">
            {t('create.step', { current: step, total: STEPS })}
          </p>
        </div>
        <div className="flex gap-2" aria-hidden="true">
          {STEP_NUMBERS.map((n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-brand' : 'bg-line'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <fieldset className="flex flex-col gap-5">
            <legend
              ref={legendRef}
              tabIndex={-1}
              className="mb-4 text-xl font-extrabold"
            >
              {t('create.what')}
            </legend>
            <Field label={t('create.titleLabel')} error={titleError}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  value={title}
                  maxLength={LIMITS.title}
                  placeholder={t('create.titlePlaceholder')}
                  onChange={(event) => setTitle(event.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  required
                />
              )}
            </Field>
            <LookPicker
              choices={looks}
              onRefresh={() => setLooks(randomLooks(looks))}
              selected={look}
              onSelect={setLook}
            />
            <Field
              label={t('create.description')}
              hint={t('create.descriptionHint')}
            >
              {({ id, describedBy }) => (
                <TextArea
                  id={id}
                  value={description}
                  maxLength={LIMITS.description}
                  onChange={(event) => setDescription(event.target.value)}
                  aria-describedby={describedBy}
                />
              )}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('create.location')} error={locationError}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    value={location}
                    maxLength={LIMITS.location}
                    placeholder={t('create.locationPlaceholder')}
                    onChange={(event) => setLocation(event.target.value)}
                  />
                )}
              </Field>
              <Field
                label={t('create.creator')}
                hint={t('create.creatorHint')}
                error={creatorError}
              >
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-invalid={invalid}
                    value={creatorName}
                    maxLength={LIMITS.creatorName}
                    autoComplete="name"
                    onChange={(event) => setCreatorName(event.target.value)}
                    aria-describedby={describedBy}
                  />
                )}
              </Field>
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="flex flex-col gap-5">
            <legend
              ref={legendRef}
              tabIndex={-1}
              className="mb-4 text-xl font-extrabold"
            >
              {t('create.when')}
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('create.from')}>
                {({ id }) => (
                  <TextInput
                    id={id}
                    type="date"
                    value={from}
                    min={today}
                    onChange={(event) => {
                      setFrom(event.target.value);
                      if (
                        isValidISODate(event.target.value) &&
                        compareISODate(to, event.target.value) < 0
                      ) {
                        setTo(event.target.value);
                      }
                    }}
                  />
                )}
              </Field>
              <Field label={t('create.to')}>
                {({ id }) => (
                  <TextInput
                    id={id}
                    type="date"
                    value={to}
                    min={from}
                    onChange={(event) => {
                      setTo(event.target.value);
                    }}
                  />
                )}
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-bold" id="weekdays-label">
                {t('create.weekdays')}
              </span>
              <div
                role="group"
                aria-labelledby="weekdays-label"
                className="flex flex-wrap gap-1.5"
              >
                {weekdayOrder(firstWeekday).map((weekday) => {
                  const on = weekdays.has(weekday);
                  return (
                    <button
                      key={weekday}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${weekdayName(weekday, locale, 'short')}: ${weekdayName(weekday, locale, 'long')}`}
                      onClick={() => {
                        const next = new Set(weekdays);
                        if (on) next.delete(weekday);
                        else next.add(weekday);
                        setWeekdays(next);
                        setManual(
                          (current) =>
                            current && {
                              chosen: current.chosen,
                              seen: forgetChangedWeekdays(
                                current.seen,
                                weekdays,
                                next
                              ),
                            }
                        );
                      }}
                      className={`min-h-11 min-w-12 rounded-full border-2 px-3 font-bold ${
                        on
                          ? 'border-brand bg-brand-soft'
                          : 'border-line bg-surface text-muted'
                      }`}
                    >
                      {weekdayName(weekday, locale, 'short')}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted">{t('create.weekdaysHint')}</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-bold" id="duration-label">
                {t('create.duration')}
              </span>
              <div
                className="flex items-center gap-3"
                role="group"
                aria-labelledby="duration-label"
              >
                <Button
                  onClick={() => setDuration(Math.max(1, duration - 1))}
                  disabled={duration <= 1}
                  aria-label={t('create.durationLess')}
                >
                  −
                </Button>
                <output
                  className="min-w-8 text-center text-2xl font-black"
                  aria-live="polite"
                >
                  {number(duration)}
                </output>
                <Button
                  onClick={() =>
                    setDuration(Math.min(LIMITS.durationDays, duration + 1))
                  }
                  disabled={duration >= LIMITS.durationDays}
                  aria-label={t('create.durationMore')}
                >
                  +
                </Button>
              </div>
              <p className="text-sm text-muted">{t('create.durationHint')}</p>
            </div>
            {rangeDays.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">{t('create.fineTune')}</p>
                <CalendarGrid
                  mode="candidates"
                  days={rangeDays}
                  marks={marks}
                  brush="yes"
                  onChange={(next) => {
                    const inRange = new Set(rangeDays);
                    setManual((current) => ({
                      chosen: new Set([
                        ...[...(current?.chosen ?? [])].filter(
                          (day) => !inRange.has(day)
                        ),
                        ...next.keys(),
                      ]),
                      seen: new Set([...(current?.seen ?? []), ...rangeDays]),
                    }));
                  }}
                  firstWeekday={firstWeekday}
                  today={today}
                  label={t('cal.label')}
                />
                <p className="font-bold" aria-live="polite">
                  {tn('create.dayCount', candidates.length)}
                </p>
              </div>
            )}
            {daysError && <Notice tone="error">{daysError}</Notice>}
          </fieldset>
        )}

        {step === 3 && (
          <fieldset className="flex flex-col gap-5">
            <legend
              ref={legendRef}
              tabIndex={-1}
              className="mb-4 text-xl font-extrabold"
            >
              {t('create.who')}
            </legend>
            <Field
              label={t('create.roster')}
              hint={t('create.rosterHint')}
              error={rosterError}
            >
              {({ id, describedBy, invalid }) => (
                <TextArea
                  id={id}
                  value={roster}
                  rows={5}
                  onChange={(event) => setRoster(event.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </Field>
            <Field
              label={t('create.minCount')}
              hint={t('create.minCountHint')}
              error={minCountError}
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  value={minCount}
                  onChange={(event) =>
                    setMinCount(asciiDigits(event.target.value))
                  }
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  className="max-w-32"
                />
              )}
            </Field>
          </fieldset>
        )}

        {submitError && <Notice tone="error">{submitError}</Notice>}

        <div className="flex flex-wrap justify-between gap-3">
          <Button
            disabled={submitting}
            onClick={() => (step === 1 ? onCancel() : setStep(step - 1))}
          >
            {t('create.back')}
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {step < STEPS
              ? t('create.next')
              : submitting
                ? t('create.creating')
                : t('create.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
