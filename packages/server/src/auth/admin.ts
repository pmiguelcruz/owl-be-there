import { createHmac, randomBytes } from 'node:crypto';
import { hashAdminToken, verifyAdminToken } from './tokens.js';

const SESSION_MS = 30 * 60_000;
const ATTEMPT_WINDOW_MS = 15 * 60_000;

export class AdminAccess {
  private readonly key: Buffer;
  private readonly pinHash: string;
  private readonly sessions = new Map<string, number>();
  private failed = 0;
  private retryAt = 0;

  constructor(secret: Buffer, pin: string) {
    this.key = createHmac('sha256', secret)
      .update('site-admin:' + pin)
      .digest();
    this.pinHash = hashAdminToken(pin);
  }

  /** Cap incorrect PINs across networks as well as at the individual route. */
  unlock(pin: string, now: number): { token: string } | 'limited' | 'invalid' {
    if (now >= this.retryAt || now < this.retryAt - ATTEMPT_WINDOW_MS) {
      this.failed = 0;
      this.retryAt = now + ATTEMPT_WINDOW_MS;
    }
    if (this.failed >= 30) return 'limited';
    if (!verifyAdminToken(pin, this.pinHash)) {
      this.failed += 1;
      return 'invalid';
    }
    for (const [token, expires] of this.sessions) {
      if (expires <= now) this.sessions.delete(token);
    }
    if (this.sessions.size >= 128)
      this.sessions.delete(this.sessions.keys().next().value!);
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(this.sign(token), now + SESSION_MS);
    return { token };
  }

  allows(token: string | undefined, now: number): boolean {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
    const expires = this.sessions.get(this.sign(token));
    return (
      expires !== undefined && expires > now && expires - now <= SESSION_MS
    );
  }

  lock(token: string | undefined): void {
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token))
      this.sessions.delete(this.sign(token));
  }

  private sign(token: string): string {
    return createHmac('sha256', this.key).update(token).digest('hex');
  }
}
