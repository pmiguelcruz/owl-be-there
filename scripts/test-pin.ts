import { createCipheriv } from 'node:crypto';

/** Test-only configuration. The fork's real key is kept outside Git. */
export const TEST_ADMIN_PIN = '4182';
const key = Buffer.alloc(32, 19);
const nonce = Buffer.alloc(12, 3);
const cipher = createCipheriv('aes-256-gcm', key, nonce);
const body = Buffer.concat([
  cipher.update(TEST_ADMIN_PIN, 'utf8'),
  cipher.final(),
]);

export const TEST_PIN_ENV = {
  ADMIN_PIN_KEY: key.toString('hex'),
  ADMIN_PIN_CIPHERTEXT: Buffer.concat([
    nonce,
    cipher.getAuthTag(),
    body,
  ]).toString('hex'),
};
