import type { DailyLog, LogEntry } from './types';

export const activity = (entry: LogEntry) =>
  ({
    drive: 'Driving',
    pickup: 'Loading',
    dropoff: 'Unloading',
    fuel: 'Fueling',
    break: '30-minute break',
    rest: '10-hour rest',
    restart: '34-hour restart',
    padding: 'Assumed off duty',
  })[entry.kind];

export function logRemarks(log: DailyLog) {
  const changes = log.entries.filter((entry, index) =>
    index > 0
      ? entry.status !== log.entries[index - 1].status
      : entry.duty_change && !entry.continues,
  );
  const stops: { start: number; end: number; entries: LogEntry[] }[] = [];
  for (const entry of log.entries) {
    if (entry.status === 'driving' || entry.kind === 'padding') continue;
    const previous = stops[stops.length - 1];
    if (
      previous &&
      previous.end === entry.start_minute &&
      previous.entries[0].location === entry.location
    ) {
      previous.end = entry.end_minute;
      previous.entries.push(entry);
    } else {
      stops.push({ start: entry.start_minute, end: entry.end_minute, entries: [entry] });
    }
  }
  const notes = stops.map((stop) => ({
    ...stop,
    location: stop.entries[0].location,
    label: [...new Set(stop.entries.map(activity))].join(' / '),
  }));
  // Driving at departure and assumed off-duty at completion still need a remark.
  for (const entry of changes) {
    if (!notes.some((note) => entry.start_minute >= note.start && entry.start_minute <= note.end)) {
      notes.push({
        start: entry.start_minute,
        end: entry.start_minute,
        entries: [entry],
        location: entry.location,
        label: activity(entry),
      });
    }
  }
  notes.sort((a, b) => a.start - b.start);
  return { changes, notes };
}
