import { jsPDF } from 'jspdf';
import type { DutyStatus, TripPlan } from './types';
import { duration } from './format';

type PrintablePlan = Pick<TripPlan, 'logs' | 'metadata' | 'locations' | 'warnings' | 'timezone'>;
const statuses: DutyStatus[] = ['off_duty', 'sleeper', 'driving', 'on_duty'];
const statusLabels = ['Off duty', 'Sleeper berth', 'Driving', 'On duty'];
// Built-in PDF fonts support Western text; remove unsupported punctuation rather than corrupting it.
const printable = (text: string) =>
  text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, ' ');
const clockMinute = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(Math.floor(minute % 60)).padStart(2, '0')}`;

export function createLogPdf(plan: PrintablePlan) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  doc.setProperties({
    title: 'Dispatch - Planned driver daily logs',
    creator: 'Dispatch Trip Planner',
  });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  function text(value: string, x: number, y: number, size = 10, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(40, 57, 46);
    doc.text(printable(value), x, y);
  }
  function footer() {
    doc.setDrawColor(210, 220, 212);
    doc.setLineWidth(0.5);
    doc.line(32, height - 40, width - 32, height - 40);
    text('Forecast only. Not a signed or certified record of actual duty.', 32, height - 24, 8);
    text(`Terminal time: ${plan.timezone}`, width - 245, height - 24, 8);
  }
  plan.logs.forEach((log, index) => {
    if (index) doc.addPage();
    text('DISPATCH / RECORD OF DUTY STATUS - PLANNED', 32, 30, 9, true);
    text("Driver's daily log", 32, 60, 23, true);
    text(log.date, width - 124, 59, 15, true);
    text(
      `From ${plan.locations[0].label} via ${plan.locations[1].label} to ${plan.locations[2].label}`,
      32,
      79,
      8,
    );
    doc.setDrawColor(44, 96, 69);
    doc.setLineWidth(1);
    doc.line(32, 89, width - 32, 89);
    const fields = [
      ['Driver', plan.metadata.driver],
      ['Carrier', plan.metadata.carrier],
      ['Vehicle / trailer', plan.metadata.vehicle],
      ['Estimated miles', `${Math.round(log.miles)} mi`],
    ];
    fields.forEach(([label, value], i) => {
      const left = 32 + i * 182;
      text(label.toUpperCase(), left, 108, 8);
      const lines = doc.splitTextToSize(printable(value || 'Not provided'), 166);
      text(lines.slice(0, 2).join('\n'), left, 124, 10, true);
    });
    const gridX = 112,
      gridY = 165,
      gridWidth = 576,
      row = 30;
    const x = (minute: number) => gridX + (minute / 1440) * gridWidth;
    const y = (status: DutyStatus) => gridY + row * (statuses.indexOf(status) + 0.5);
    for (let i = 0; i <= 96; i++) {
      doc.setDrawColor(i % 4 ? 230 : 180, i % 4 ? 236 : 196, i % 4 ? 232 : 184);
      doc.setLineWidth(i % 4 ? 0.3 : 0.6);
      doc.line(gridX + i * 6, gridY, gridX + i * 6, gridY + row * 4);
      if (i % 4 === 0)
        text(
          i === 0 || i === 96 ? 'MN' : i === 48 ? 'Noon' : String((i / 4) % 12),
          gridX + i * 6 - 4,
          gridY - 10,
          7,
        );
    }
    for (let i = 0; i <= 4; i++) {
      doc.setDrawColor(180, 196, 184);
      doc.line(gridX, gridY + i * row, gridX + gridWidth, gridY + i * row);
      if (i < 4) {
        text(statusLabels[i], 32, gridY + i * row + 19, 10);
        text(duration(log.totals[statuses[i]]), gridX + gridWidth + 12, gridY + i * row + 19, 9);
      }
    }
    text('TOTAL', gridX + gridWidth + 12, gridY - 10, 7);
    doc.setDrawColor(32, 113, 94);
    doc.setLineWidth(2);
    log.entries.forEach((entry, i) => {
      if (i)
        doc.line(
          x(entry.start_minute),
          y(log.entries[i - 1].status),
          x(entry.start_minute),
          y(entry.status),
        );
      doc.line(x(entry.start_minute), y(entry.status), x(entry.end_minute), y(entry.status));
    });
    text('One calendar day - 24 hours', gridX + gridWidth - 133, gridY + row * 4 + 16, 8);
    text('24h 00m', gridX + gridWidth + 12, gridY + row * 4 + 16, 9, true);
    text('REMARKS / DUTY CHANGES', 32, 332, 9, true);
    let top = 352;
    log.entries.forEach((entry) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const lines: string[] = doc.splitTextToSize(printable(entry.location), width - 200);
      const lineHeight = Math.max(18, lines.length * 12 + 6);
      if (top + lineHeight > height - 80) {
        footer();
        doc.addPage();
        text(`${log.date} - Remarks continued`, 32, 38, 15, true);
        top = 65;
      }
      text(clockMinute(entry.start_minute), 32, top, 9);
      text(
        `${entry.continues ? 'Cont. ' : ''}${entry.kind === 'padding' ? 'Off duty' : entry.kind}`,
        80,
        top,
        9,
      );
      text(lines.join('\n'), 172, top, 9);
      top += lineHeight;
    });
    text(
      `Shipping document: ${plan.metadata.shipping || 'Not provided'}`,
      32,
      Math.min(top + 12, height - 55),
      8,
    );
    footer();
  });
  doc.addPage();
  text('Planning assumptions and limitations', 32, 45, 19, true);
  let top = 80;
  const notes = [
    'Property-carrying driver, 70 hours / 8 days. Departure follows 10 consecutive hours off duty with fresh daily clocks.',
    'Pickup and delivery each take one hour on duty. Fueling takes 30 minutes on duty, at most every 1,000 miles, starting fully fueled.',
    ...plan.warnings,
  ];
  notes.forEach((note) => {
    doc.setFontSize(11);
    const lines: string[] = doc.splitTextToSize(printable(note), width - 64);
    text(lines.join('\n'), 32, top, 11);
    top += lines.length * 15 + 18;
  });
  footer();
  return doc;
}

export function downloadLogs(plan: PrintablePlan) {
  createLogPdf(plan).save(`dispatch-logs-${plan.logs[0].date}.pdf`);
}
