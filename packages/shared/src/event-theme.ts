import { z } from 'zod';

const color = z.string().regex(/^#[a-f0-9]{6}$/i);

export const EventTheme = z.strictObject({
  gradient: z.strictObject({
    start: color,
    end: color,
    angle: z.int().min(0).max(359),
  }),
  shape: z.int().min(0).max(0xffff_ffff),
});

export type EventThemeData = z.infer<typeof EventTheme>;
