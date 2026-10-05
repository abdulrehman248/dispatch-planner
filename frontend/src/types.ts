export type Coordinates = [number, number];
export type Location = { label: string; coordinates: Coordinates };
export type DutyStatus = 'off_duty' | 'sleeper' | 'driving' | 'on_duty';
export type EventKind = 'drive' | 'pickup' | 'dropoff' | 'fuel' | 'break' | 'rest' | 'restart';
export type TripEvent = {
  id: number;
  kind: EventKind;
  status: DutyStatus;
  start: string;
  end: string;
  miles: number;
  location: string;
  coordinates: Coordinates;
  end_coordinates: Coordinates;
  reason: string;
  leg: number;
  cycle_used: number;
  driving_used: number;
  shift_elapsed: number;
};
export type LogEntry = {
  event_id: number | null;
  status: DutyStatus;
  start_minute: number;
  end_minute: number;
  location: string;
  kind: EventKind | 'padding';
  continues?: boolean;
  reason?: string;
  duty_change?: boolean;
};
export type DailyLog = {
  date: string;
  timezone: string;
  entries: LogEntry[];
  totals: Record<DutyStatus, number>;
  miles: number;
};
export type Metadata = { driver: string; carrier: string; vehicle: string; shipping: string };
export type PlanInput = Metadata & {
  current: Location;
  pickup: Location;
  dropoff: Location;
  cycle_used: number;
  departure: string;
  timezone: string;
};
export type TripPlan = {
  locations: Location[];
  geometry: { type: 'LineString'; coordinates: Coordinates[] };
  directions: { leg: number; instruction: string; miles: number }[];
  events: TripEvent[];
  logs: DailyLog[];
  timezone: string;
  initial_cycle_used: number;
  metadata: Metadata;
  summary: {
    miles: number;
    driving_hours: number;
    elapsed_hours: number;
    arrival: string;
    completion: string;
    days: number;
    cycle_remaining: number;
    stops: number;
  };
  warnings: string[];
  validation: { passed: boolean; checks: string[] };
};
