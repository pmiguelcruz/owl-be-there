import { isId, LanguageSchema, type Language } from '@owl/shared';
import { z } from 'zod';
import { browserBacking, Store } from './storage.ts';

/**
 * Everything the browser remembers, and nothing the server does: the theme,
 * the language and who you are in each event. All of it lives in localStorage under `owl.*`, and
 * every read is checked against a schema.
 */
const store = new Store(browserBacking());

export type ThemeChoice = 'system' | 'light' | 'dark';

const ThemeSchema = z.enum(['light', 'dark']);

export function readTheme(): ThemeChoice {
  return store.read('owl.theme', ThemeSchema) ?? 'system';
}

/** Persist the choice and stamp it on the document, as the inline script does on load. */
export function writeTheme(theme: ThemeChoice): void {
  if (theme === 'system') {
    store.remove('owl.theme');
    document.documentElement.removeAttribute('data-theme');
  } else {
    store.write('owl.theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function readLanguage(): Language | null {
  return store.read('owl.lang', LanguageSchema);
}

export function writeLanguage(language: Language): void {
  store.write('owl.lang', language);
}

const SessionSchema = z.object({
  participantId: z.string().refine(isId),
  token: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;

export function readSession(eventId: string): Session | null {
  return store.read(`owl.session.${eventId}`, SessionSchema);
}

export function writeSession(eventId: string, session: Session): void {
  store.write(`owl.session.${eventId}`, session);
}

export function clearSession(eventId: string): void {
  store.remove(`owl.session.${eventId}`);
}

/** Keep this device's session for an event, or forget it for `null`. */
export function storeSession(eventId: string, session: Session | null): void {
  if (session) writeSession(eventId, session);
  else clearSession(eventId);
}

/** Import the old browser-local event history once. Old admin keys are obsolete. */
export function legacyVisitIds(): string[] {
  const entries = store.read('owl.events', z.array(z.unknown())) ?? [];
  const schema = z.object({ id: z.string().refine(isId) });
  return entries
    .flatMap((entry) => {
      const parsed = schema.safeParse(entry);
      return parsed.success ? [parsed.data.id] : [];
    })
    .slice(0, 40);
}

export function clearLegacyVisits(): void {
  for (const id of legacyVisitIds()) store.remove(`owl.admin.${id}`);
  store.remove('owl.events');
}
