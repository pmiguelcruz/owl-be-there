import { createHmac, timingSafeEqual } from 'node:crypto';
import { hashAdminToken, verifyAdminToken } from './tokens.js';

const SESSION_MS = 30 * 60_000;
const ATTEMPT_WINDOW_MS = 15 * 60_000;

export class CreationAccess {
  private readonly key: Buffer;
  private readonly pinHash: string;
  private failed = 0;
  private retryAt = 0;

  constructor(secret: Buffer, pin: string) {
    this.key = createHmac('sha256', secret)
      .update('event-creation:' + pin)
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
    const expires = now + SESSION_MS;
    return { token: `${expires}.${this.sign(expires)}` };
  }

  allows(token: string | undefined, now: number): boolean {
    const match = token && /^(\d{1,16})\.([a-f0-9]{64})$/.exec(token);
    if (!match) return false;
    const expires = Number(match[1]);
    return (
      expires > now &&
      expires - now <= SESSION_MS &&
      timingSafeEqual(
        Buffer.from(this.sign(expires), 'hex'),
        Buffer.from(match[2]!, 'hex')
      )
    );
  }

  private sign(expires: number): string {
    return createHmac('sha256', this.key).update(String(expires)).digest('hex');
  }
}
