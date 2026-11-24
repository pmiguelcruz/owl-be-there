import { createDecipheriv } from 'node:crypto';

// AES-256-GCM envelope for this fork's PIN. Its random key is provisioned
// through ADMIN_PIN_KEY on the server.
export const FORK_PIN =
  '96f1819cf66f8ff27997af0f73f50e1bfe1147fd7b37bdf13b3da9b109fd4a8b';

export function openPin(key: string, envelope: string): string {
  if (!/^[a-f0-9]{64}$/i.test(key) || !/^[a-f0-9]{64}$/i.test(envelope))
    throw new Error('Invalid admin PIN envelope');
  const payload = Buffer.from(envelope, 'hex');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    payload.subarray(0, 12)
  );
  decipher.setAuthTag(payload.subarray(12, 28));
  const pin = Buffer.concat([
    decipher.update(payload.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
  if (!/^\d{4}$/.test(pin)) throw new Error('Invalid admin PIN');
  return pin;
}
