import { describe, expect, it } from 'vitest';
import { clock, dateLabel, duration } from './format';

describe('log presentation', () => {
  it('carries rounded minutes into the next hour', () => {
    expect(duration(1.9999)).toBe('2h 00m');
    expect(duration(34)).toBe('34h 00m');
  });
  it('uses terminal time instead of the computer timezone', () => {
    expect(clock('2026-10-06T02:00:00Z', 'America/Chicago')).toBe('9:00 PM');
    expect(dateLabel('2026-10-06T02:00:00Z', 'America/Chicago')).toBe('Oct 5');
  });
});
