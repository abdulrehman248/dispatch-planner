import { describe, expect, it } from 'vitest';
import { createLogPdf } from './pdf';
import type { TripPlan } from './types';

describe('vector log export', () => {
  it('exports each calendar day plus the assumptions page', () => {
    const input: Pick<TripPlan, 'logs' | 'metadata' | 'locations' | 'warnings' | 'timezone'> = {
      logs: ['2026-10-05', '2026-10-06'].map((date) => ({
        date,
        timezone: 'America/Chicago',
        miles: 0,
        totals: { off_duty: 24, sleeper: 0, driving: 0, on_duty: 0 },
        entries: [
          {
            event_id: 0,
            status: 'off_duty',
            start_minute: 0,
            end_minute: 1440,
            location: 'Dallas, TX',
            kind: 'restart',
          },
        ],
      })),
      metadata: { driver: '', carrier: '', vehicle: '', shipping: '' },
      locations: Array.from({ length: 3 }, () => ({
        label: 'Dallas, TX',
        coordinates: [-96.8, 32.7],
      })),
      warnings: ['Planned logs, not an actual duty record.'],
      timezone: 'America/Chicago',
    };
    const doc = createLogPdf(input);
    expect(doc.getNumberOfPages()).toBe(3);
    expect(doc.output()).toMatch(/^%PDF-/);
    expect(doc.output()).toContain('2026-10-05');
    expect(doc.output()).toContain('2026-10-06');
  });
});
