import type { DailyLog, DutyStatus, TripPlan } from '../types';
import { dateLabel, duration, integer } from '../format';

const statuses: DutyStatus[] = ['off_duty', 'sleeper', 'driving', 'on_duty'];
const labels = ['Off duty', 'Sleeper berth', 'Driving', 'On duty'];
const x = (minute: number) => 110 + (minute / 1440) * 720;
const y = (status: DutyStatus) => 58 + statuses.indexOf(status) * 42;
const minuteLabel = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(Math.floor(minute % 60)).padStart(2, '0')}`;

export default function LogSheet({
  log,
  plan,
  selected,
  onSelect,
}: {
  log: DailyLog;
  plan: TripPlan;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  let path = '';
  log.entries.forEach((entry, index) => {
    path += `${index ? 'L' : 'M'}${x(entry.start_minute)} ${y(entry.status)} L${x(entry.end_minute)} ${y(entry.status)} `;
  });
  return (
    <article className="log-sheet">
      <div className="log-heading">
        <div>
          <div className="eyebrow">RECORD OF DUTY STATUS · PLANNED</div>
          <h2>Driver’s daily log</h2>
        </div>
        <div className="log-date">
          {dateLabel(log.date)}
          <small>
            {log.date.slice(0, 4)} · {log.timezone.replace('America/', '').replaceAll('_', ' ')}
          </small>
        </div>
      </div>
      <div className="log-metadata">
        <div>
          <span>Driver</span>
          <strong>{plan.metadata.driver || 'Not provided'}</strong>
        </div>
        <div>
          <span>Carrier</span>
          <strong>{plan.metadata.carrier || 'Not provided'}</strong>
        </div>
        <div>
          <span>Vehicle / trailer</span>
          <strong>{plan.metadata.vehicle || 'Not provided'}</strong>
        </div>
        <div>
          <span>Estimated miles today</span>
          <strong>{integer(log.miles)} mi</strong>
        </div>
      </div>
      <div className="grid-scroll">
        <svg
          className="log-grid"
          viewBox="0 0 920 235"
          role="img"
          aria-label={`24-hour duty status graph for ${log.date}`}
        >
          <title>Driver duty status: {log.date}</title>
          <rect x="110" y="37" width="720" height="168" fill="#fff" stroke="#a9b6b1" />
          {Array.from({ length: 97 }, (_, i) => (
            <line
              key={i}
              x1={110 + i * 7.5}
              x2={110 + i * 7.5}
              y1="37"
              y2="205"
              stroke={i % 4 === 0 ? '#b7c4bf' : '#e6ece8'}
              strokeWidth={i % 4 === 0 ? 1 : 0.5}
            />
          ))}
          {Array.from({ length: 25 }, (_, i) => (
            <text key={i} x={110 + i * 30} y="25" textAnchor="middle" fontSize="10" fill="#56665f">
              {i === 0 || i === 24 ? 'MN' : i === 12 ? 'Noon' : i % 12}
            </text>
          ))}
          {statuses.map((status, i) => (
            <g key={status}>
              <text x="96" y={y(status) + 4} textAnchor="end" fontSize="12" fill="#32443c">
                {labels[i]}
              </text>
              <line x1="110" x2="830" y1={37 + i * 42} y2={37 + i * 42} stroke="#b7c4bf" />
              <text x="880" y={y(status) + 4} textAnchor="middle" fontSize="12" fill="#223c31">
                {duration(log.totals[status])}
              </text>
            </g>
          ))}
          <text x="880" y="25" textAnchor="middle" fontSize="10" fill="#56665f">
            HOURS
          </text>
          <path d={path} fill="none" stroke="#20715e" strokeWidth="2.6" strokeLinejoin="round" />
          {log.entries
            .filter((e) => e.event_id !== null)
            .map((entry, i) => (
              <g
                key={i}
                role="button"
                tabIndex={0}
                aria-label={`${entry.kind}, ${minuteLabel(entry.start_minute)} to ${minuteLabel(entry.end_minute)}`}
                onClick={() => onSelect(entry.event_id!)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(entry.event_id!);
                  }
                }}
              >
                <rect
                  x={x(entry.start_minute)}
                  y={y(entry.status) - 14}
                  width={Math.max(3, x(entry.end_minute) - x(entry.start_minute))}
                  height="28"
                  fill={selected === entry.event_id ? '#aee185' : 'transparent'}
                  opacity="0.45"
                />
                <title>
                  {entry.kind}: {entry.location}
                </title>
              </g>
            ))}
          <text x="830" y="226" textAnchor="end" fontSize="11" fill="#56665f">
            One calendar day · 24 hours
          </text>
          <text x="880" y="226" textAnchor="middle" fontSize="12" fontWeight="600">
            24h 00m
          </text>
        </svg>
      </div>
      <div className="log-remarks">
        <div className="eyebrow">REMARKS & DUTY CHANGES</div>
        {log.entries.map((entry, i) => (
          <div
            key={i}
            className={`remark ${selected !== null && selected === entry.event_id ? 'selected' : ''}`}
          >
            <span>{minuteLabel(entry.start_minute)}</span>
            <span>
              {entry.continues ? 'Continued · ' : ''}
              {entry.kind === 'padding'
                ? 'Off duty'
                : entry.kind.replace('dropoff', 'Delivery').replace('pickup', 'Pickup')}
            </span>
            <span>{entry.location}</span>
          </div>
        ))}
      </div>
      <footer className="log-footer">
        <span>Shipping document: {plan.metadata.shipping || 'Not provided'}</span>
        <span>Forecast only · Not signed or certified</span>
      </footer>
    </article>
  );
}
