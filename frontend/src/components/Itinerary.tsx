import { BedDouble, Coffee, Fuel, PackageCheck, PackagePlus, RotateCcw, Truck } from 'lucide-react';
import type { EventKind, TripPlan } from '../types';
import { clock, dateLabel, duration, integer } from '../format';

const icons = {
  drive: Truck,
  pickup: PackagePlus,
  dropoff: PackageCheck,
  fuel: Fuel,
  break: Coffee,
  rest: BedDouble,
  restart: RotateCcw,
};
const names: Record<EventKind, string> = {
  drive: 'Drive',
  pickup: 'Pickup',
  dropoff: 'Delivery',
  fuel: 'Fuel stop',
  break: '30-minute break',
  rest: 'Daily rest',
  restart: 'Cycle restart',
};

export default function Itinerary({
  plan,
  selected,
  onSelect,
}: {
  plan: TripPlan;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="itinerary">
      <div className="section-heading">
        <div>
          <h2>Your itinerary</h2>
          <p>Every stop, with a reason.</p>
        </div>
        <span className="small-badge">{plan.events.length} events</span>
      </div>
      {plan.events.map((event, i) => {
        const Icon = icons[event.kind];
        const previousDay = i ? dateLabel(plan.events[i - 1].start, plan.timezone) : '';
        const day = dateLabel(event.start, plan.timezone);
        return (
          <div key={event.id}>
            {previousDay !== day && <div className="itinerary-day">{day}</div>}
            <button
              className={`event-row ${selected === event.id ? 'active' : ''}`}
              onClick={() => onSelect(event.id)}
              aria-expanded={selected === event.id}
            >
              <span className={`event-icon ${event.kind}`}>
                <Icon size={18} />
              </span>
              <span className="event-main">
                <strong>
                  {names[event.kind]}
                  {event.kind === 'drive' && <span> · {integer(event.miles)} mi</span>}
                </strong>
                <span className="event-location">
                  {event.kind === 'drive'
                    ? `To ${plan.locations[event.leg + 1].label}`
                    : event.location}
                </span>
                {selected === event.id && (
                  <span className="event-reason">
                    {event.reason}
                    <span className="event-clocks">
                      After this event: {duration(Math.max(0, 70 - event.cycle_used))} cycle
                      remaining
                    </span>
                  </span>
                )}
              </span>
              <span className="event-time">
                <strong>{clock(event.start, plan.timezone)}</strong>
                <span>
                  {duration(
                    (new Date(event.end).getTime() - new Date(event.start).getTime()) / 3_600_000,
                  )}
                </span>
              </span>
            </button>
          </div>
        );
      })}
      <div className="trip-complete">
        <PackageCheck size={18} />
        <div>
          <strong>Trip complete</strong>
          <span>
            {dateLabel(plan.summary.completion, plan.timezone)} ·{' '}
            {clock(plan.summary.completion, plan.timezone)} · Unloading included
          </span>
        </div>
      </div>
    </div>
  );
}
