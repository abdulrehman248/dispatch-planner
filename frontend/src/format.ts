export function duration(hours: number): string {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
export function clock(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(iso));
}
export function dateLabel(iso: string, timezone = 'UTC'): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));
}
export function zoneLabel(iso: string, timezone: string): string {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
      .formatToParts(new Date(iso))
      .find((p) => p.type === 'timeZoneName')?.value || timezone
  );
}
export const integer = (value: number) => Math.round(value).toLocaleString('en-US');
