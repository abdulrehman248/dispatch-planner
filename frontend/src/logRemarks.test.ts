import { describe, expect, it } from 'vitest';
import { logRemarks } from './logRemarks';
import type { DailyLog, LogEntry } from './types';
const entry = (
  status: LogEntry['status'],
  start: number,
  end: number,
  kind: LogEntry['kind'],
): LogEntry => ({
  status,
  start_minute: start,
  end_minute: end,
  kind,
  event_id: start,
  location: 'Dallas, TX',
});
const log = (entries: LogEntry[]): DailyLog => ({
  entries,
  date: '2026-10-05',
  timezone: 'America/Chicago',
  miles: 0,
  totals: { driving: 0, on_duty: 0, off_duty: 0, sleeper: 0 },
});
describe('log annotations', () => {
  it('marks status changes rather than every activity and brackets a stationary stop', () => {
    const result = logRemarks(
      log([
        entry('driving', 0, 60, 'drive'),
        entry('on_duty', 60, 90, 'fuel'),
        entry('on_duty', 90, 150, 'pickup'),
        entry('driving', 150, 240, 'drive'),
      ]),
    );
    expect(result.changes.map((e) => e.start_minute)).toEqual([60, 150]);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatchObject({ start: 60, end: 150, label: 'Fueling / Loading' });
  });
  it('does not invent midnight changes but retains genuine midnight transitions', () => {
    const rest = entry('sleeper', 0, 600, 'rest');
    expect(logRemarks(log([{ ...rest, continues: true }])).changes).toHaveLength(0);
    expect(logRemarks(log([{ ...rest, duty_change: true }])).changes).toHaveLength(1);
  });
  it('keeps assumed padding out of stationary brackets', () => {
    const result = logRemarks(
      log([entry('on_duty', 0, 60, 'dropoff'), entry('off_duty', 60, 1440, 'padding')]),
    );
    expect(result.changes).toHaveLength(1);
    expect(result.notes[0].end).toBe(60);
  });
});
