import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBrowser } from './browser.ts';

const ID = '7gT4kPq2Wx9Z';
const OTHER = 'Kd8mQ3vNp2Ra';

let browser: ReturnType<typeof installBrowser>;
let prefs: typeof import('../src/lib/prefs.ts');

beforeEach(async () => {
  vi.resetModules();
  browser = installBrowser();
  prefs = await import('../src/lib/prefs.ts');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefs', () => {
  it('stores the theme and stamps it on the document, or clears both for system', () => {
    expect(prefs.readTheme()).toBe('system');
    prefs.writeTheme('dark');
    expect(prefs.readTheme()).toBe('dark');
    expect(browser.attributes.get('data-theme')).toBe('dark');
    expect(browser.storage.getItem('owl.theme')).toBe('"dark"');
    prefs.writeTheme('system');
    expect(prefs.readTheme()).toBe('system');
    expect(browser.attributes.has('data-theme')).toBe(false);
  });

  it('remembers the language', () => {
    expect(prefs.readLanguage()).toBeNull();
    prefs.writeLanguage('de');
    expect(prefs.readLanguage()).toBe('de');
    prefs.writeLanguage('es');
    expect(prefs.readLanguage()).toBe('es');
    prefs.writeLanguage('fr');
    expect(prefs.readLanguage()).toBe('fr');
    prefs.writeLanguage('pt');
    expect(prefs.readLanguage()).toBe('pt');
    prefs.writeLanguage('it');
    expect(prefs.readLanguage()).toBe('it');
    prefs.writeLanguage('ja');
    expect(prefs.readLanguage()).toBe('ja');
    prefs.writeLanguage('nl');
    expect(prefs.readLanguage()).toBe('nl');
  });

  it('keeps one session per event and ignores a malformed one', () => {
    prefs.writeSession(ID, { participantId: OTHER, token: 't' });
    expect(prefs.readSession(ID)).toEqual({
      participantId: OTHER,
      token: 't',
    });
    expect(prefs.readSession(OTHER)).toBeNull();
    browser.storage.setItem(
      `owl.session.${OTHER}`,
      '{"participantId":"bad","token":"t","name":"x"}'
    );
    expect(prefs.readSession(OTHER)).toBeNull();
    prefs.clearSession(ID);
    expect(prefs.readSession(ID)).toBeNull();
  });

  it('stores a session, replaces it, and forgets it for null', () => {
    prefs.storeSession(ID, { participantId: OTHER, token: 'a' });
    expect(prefs.readSession(ID)).toEqual({ participantId: OTHER, token: 'a' });
    prefs.storeSession(ID, { participantId: OTHER, token: 'b' });
    expect(prefs.readSession(ID)?.token).toBe('b');
    prefs.storeSession(ID, null);
    expect(prefs.readSession(ID)).toBeNull();
    expect(browser.storage.getItem(`owl.session.${ID}`)).toBeNull();
    // Nothing stored, nothing to forget: no error, no entry.
    expect(() => prefs.storeSession(OTHER, null)).not.toThrow();
    expect(prefs.readSession(OTHER)).toBeNull();
  });

  it('imports valid legacy event IDs and removes the old organizer key without clearing the entry session', () => {
    browser.storage.setItem(
      'owl.events',
      JSON.stringify([{ id: ID }, { id: 'bad' }])
    );
    browser.storage.setItem(`owl.admin.${ID}`, 'old');
    prefs.writeSession(ID, { participantId: OTHER, token: 'entry' });
    expect(prefs.legacyVisitIds()).toEqual([ID]);
    prefs.clearLegacyVisits();
    expect(prefs.legacyVisitIds()).toEqual([]);
    expect(browser.storage.getItem(`owl.admin.${ID}`)).toBeNull();
    expect(prefs.readSession(ID)?.token).toBe('entry');
  });
});
