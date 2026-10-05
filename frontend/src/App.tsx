import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Info,
  Map,
  Navigation,
  Route,
  Settings2,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import { createPlan } from './api';
import { examples } from './examples';
import { clock, dateLabel, duration, integer, zoneLabel } from './format';
import type { Location, Metadata, TripPlan } from './types';
import LocationField from './components/LocationField';
import RouteMap from './components/RouteMap';
import LogSheet from './components/LogSheet';
import Itinerary from './components/Itinerary';

function initialDeparture() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  return `${date}T08:00`;
}

export default function App() {
  const [locations, setLocations] = useState<(Location | null)[]>(examples[0].locations);
  const [cycle, setCycle] = useState('12');
  const [departure, setDeparture] = useState(initialDeparture);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [metadata, setMetadata] = useState<Metadata>({
    driver: '',
    carrier: '',
    vehicle: '',
    shipping: '',
  });
  const [settings, setSettings] = useState(false);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState(0);
  const [day, setDay] = useState(0);
  const [assumptions, setAssumptions] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const cycleValid =
    cycle.trim() !== '' &&
    Number.isFinite(Number(cycle)) &&
    Number(cycle) >= 0 &&
    Number(cycle) <= 70;

  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [busy]);

  const changed = () => {
    setDirty(true);
    setError('');
  };
  const selectEvent = (id: number) => {
    setSelected(id);
    const logIndex = plan?.logs.findIndex((log) =>
      log.entries.some((entry) => entry.event_id === id),
    );
    if (logIndex !== undefined && logIndex >= 0) setDay(logIndex);
  };

  async function generate() {
    if (!cycleValid || locations.some((location) => !location) || !departure) {
      setError('Select all three locations, enter 0–70 cycle hours, and choose a departure time.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await createPlan({
        current: locations[0]!,
        pickup: locations[1]!,
        dropoff: locations[2]!,
        cycle_used: Number(cycle),
        departure,
        timezone,
        ...metadata,
      });
      setPlan(result);
      setSelected(null);
      setDay(0);
      setDirty(false);
      setTab(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to generate this trip.');
    } finally {
      setBusy(false);
    }
  }

  async function exportLogs() {
    if (!plan) return;
    setExporting(true);
    setExportError('');
    try {
      const { downloadLogs } = await import('./pdf');
      downloadLogs(plan);
    } catch {
      setExportError('Could not download the logs. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <header className="app-header no-print">
        <a className="brand" href="/" aria-label="Dispatch home">
          <span className="brand-mark">
            <Route size={23} />
          </span>
          <span>
            dispatch<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-divider" />
        <span className="header-section">Trip planner</span>
        <div className="header-right">
          <span className="edition">PROPERTY CARRIER · 70 / 8</span>
          <button
            className="icon-text"
            aria-label="Planning guide"
            onClick={() => setAssumptions(true)}
          >
            <Info size={17} />
            <span>Planning guide</span>
          </button>
        </div>
      </header>
      <main className="app-layout no-print">
        <aside className="sidebar">
          <div className="sidebar-intro">
            <div className="eyebrow">PLAN YOUR NEXT MOVE</div>
            <h1>A clear road ahead.</h1>
            <p>
              Your route, required rests, and daily logs.
              <br />
              Planned together.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <div className="form-section-title">
              <span>Trip details</span>
              <span className="step-label">01 — ROUTE</span>
            </div>
            <div className="location-fields">
              {['Current location', 'Pickup location', 'Dropoff location'].map((label, index) => (
                <div className="location-row" key={label}>
                  <span className={`location-dot point-${index}`}>
                    {index === 2 ? <span /> : index === 1 ? <span /> : <Navigation size={12} />}
                  </span>
                  <LocationField
                    label={label}
                    value={locations[index]}
                    disabled={busy}
                    onChange={(next) => {
                      setLocations((previous) =>
                        previous.map((location, i) => (i === index ? next : location)),
                      );
                      changed();
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="form-section-title hours-heading">
              <span>Driver’s hours</span>
              <span className="step-label">02 — CAPACITY</span>
            </div>
            <TextField
              fullWidth
              size="small"
              label="Current cycle used"
              type="number"
              value={cycle}
              disabled={busy}
              onChange={(e) => {
                setCycle(e.target.value);
                changed();
              }}
              error={!cycleValid}
              helperText={!cycleValid ? 'Enter a value from 0 to 70 hours.' : undefined}
              slotProps={{
                htmlInput: { min: 0, max: 70, step: '0.01' },
                input: { endAdornment: <span className="input-unit">hrs</span> },
              }}
            />
            <div className="capacity">
              <div>
                <span>Available this cycle</span>
                <strong>{duration(cycleValid ? 70 - Number(cycle) : 0)}</strong>
              </div>
              <LinearProgress
                variant="determinate"
                value={cycleValid ? ((70 - Number(cycle)) / 70) * 100 : 0}
              />
              <p>Includes driving, loading, unloading, and fuel.</p>
            </div>
            <button
              type="button"
              className="settings-toggle"
              onClick={() => setSettings((v) => !v)}
              aria-expanded={settings}
            >
              <Settings2 size={16} />
              <span>Trip settings</span>
              <ChevronDown size={16} className={settings ? 'rotated' : ''} />
            </button>
            <Collapse in={settings}>
              <div className="settings-fields">
                <TextField
                  fullWidth
                  size="small"
                  label="Departure · terminal local time"
                  type="datetime-local"
                  value={departure}
                  disabled={busy}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      const date = new Date(`${value}Z`);
                      date.setUTCMinutes(Math.ceil(date.getUTCMinutes() / 15) * 15, 0, 0);
                      setDeparture(date.toISOString().slice(0, 16));
                    } else setDeparture(value);
                    changed();
                  }}
                  helperText="15-minute intervals; rounded up when needed"
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 900 } }}
                />
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Home-terminal time zone"
                  value={timezone}
                  disabled={busy}
                  onChange={(e) => {
                    setTimezone(e.target.value);
                    changed();
                  }}
                >
                  {[
                    ['America/New_York', 'Eastern'],
                    ['America/Chicago', 'Central'],
                    ['America/Denver', 'Mountain'],
                    ['America/Los_Angeles', 'Pacific'],
                    ['America/Phoenix', 'Arizona (no DST)'],
                  ].map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <p className="settings-note">Optional details for your log sheets</p>
                {(['driver', 'carrier', 'vehicle', 'shipping'] as const).map((key) => (
                  <TextField
                    key={key}
                    size="small"
                    label={
                      {
                        driver: 'Driver name',
                        carrier: 'Carrier name',
                        vehicle: 'Vehicle / trailer',
                        shipping: 'Shipping document',
                      }[key]
                    }
                    value={metadata[key]}
                    disabled={busy}
                    slotProps={{ htmlInput: { maxLength: key === 'vehicle' ? 80 : 100 } }}
                    onChange={(e) => {
                      setMetadata({ ...metadata, [key]: e.target.value });
                      changed();
                    }}
                  />
                ))}
              </div>
            </Collapse>
            <div className="departure-preview">
              <Clock3 size={14} />
              <span>
                {departure.replace('T', ' · ')} ·{' '}
                {timezone.replace('America/', '').replaceAll('_', ' ')}
              </span>
            </div>
            <Button
              fullWidth
              variant="contained"
              size="large"
              type="submit"
              disabled={busy}
              startIcon={
                busy ? <CircularProgress size={17} color="inherit" /> : <Route size={18} />
              }
            >
              {busy
                ? 'Planning your trip…'
                : plan && dirty
                  ? 'Update trip plan'
                  : 'Generate trip plan'}
            </Button>
            {busy && (
              <p className="loading-note" role="status">
                {slow
                  ? 'The free-hosted API may need a minute to wake up. We’re still working on your route.'
                  : 'Finding your route and fitting in the required stops.'}
              </p>
            )}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </form>
          <div className="examples">
            <div className="eyebrow">TRY A SAMPLE TRIP</div>
            {examples.map((example) => (
              <button
                key={example.name}
                disabled={busy}
                onClick={() => {
                  setLocations(example.locations);
                  setCycle(String(example.cycle));
                  changed();
                }}
              >
                <span>
                  <strong>{example.name}</strong>
                  <small>{example.description}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <div className="sidebar-footnote">
            <ShieldCheck size={18} />
            <p>
              Fresh daily clocks at departure.
              <br /> Cycle restarts are planned when needed.
              <button onClick={() => setAssumptions(true)}>View planning assumptions</button>
            </p>
          </div>
        </aside>
        <section className="workspace">
          <div className="workspace-heading">
            <div>
              <div className="eyebrow">TRIP WORKSPACE</div>
              <h2>
                {plan
                  ? `${plan.locations[0].label.split(',')[0]} to ${plan.locations[2].label.split(',')[0]}`
                  : 'Make every mile count.'}
              </h2>
              <p>
                {plan
                  ? `Via ${plan.locations[1].label} · All times in ${zoneLabel(plan.events[0].start, plan.timezone)}`
                  : 'Start with your locations. We’ll take care of the timeline.'}
              </p>
            </div>
            {plan && (
              <Button
                className="export-button"
                variant="outlined"
                startIcon={<Download size={16} />}
                disabled={exporting}
                onClick={() => void exportLogs()}
              >
                {exporting ? 'Preparing PDF…' : 'Download logs'}
              </Button>
            )}
          </div>
          {exportError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {exportError}
            </Alert>
          )}
          {dirty && plan && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Inputs have changed. Showing your previous plan until you update it.
            </Alert>
          )}
          {plan && (
            <div className="summary-strip" aria-live="polite">
              <div>
                <span>Total distance</span>
                <strong>
                  {integer(plan.summary.miles)} <small>mi</small>
                </strong>
              </div>
              <div>
                <span>Driving time</span>
                <strong>{duration(plan.summary.driving_hours)}</strong>
              </div>
              <div>
                <span>Trip duration</span>
                <strong>{duration(plan.summary.elapsed_hours)}</strong>
              </div>
              <div>
                <span>Delivery arrival</span>
                <strong className="arrival-value">
                  {dateLabel(plan.summary.arrival, plan.timezone)}{' '}
                  <small>{clock(plan.summary.arrival, plan.timezone)}</small>
                </strong>
              </div>
            </div>
          )}
          <div className="workspace-tabs">
            <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Trip views">
              <Tab icon={<Map size={17} />} iconPosition="start" label="Route & itinerary" />
              <Tab
                icon={<FileText size={17} />}
                iconPosition="start"
                label={plan ? `Daily logs (${plan.logs.length})` : 'Daily logs'}
                disabled={!plan}
              />
            </Tabs>
            {plan && (
              <span className="validated">
                <ShieldCheck size={14} /> Schedule checked
              </span>
            )}
          </div>
          {tab === 0 ? (
            <>
              <RouteMap plan={plan} selected={selected} onSelect={selectEvent} />
              {!plan ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Truck size={26} />
                  </div>
                  <div>
                    <h3>Your next trip starts here</h3>
                    <p>
                      Choose a sample or enter your stops, then generate a plan.
                      <br />
                      Driving, fuel, rest, and logs will fall into place.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="route-note">
                    <Info size={15} />
                    <span>
                      Estimated road route. Fuel and rest pins are approximate planning points;
                      confirm safe facilities before travel.
                    </span>
                  </div>
                  <Itinerary plan={plan} selected={selected} onSelect={selectEvent} />
                  <div className="directions-panel">
                    <button
                      className="settings-toggle"
                      onClick={() => setShowDirections((v) => !v)}
                      aria-expanded={showDirections}
                    >
                      <Navigation size={17} />
                      <span>Route instructions</span>
                      <ChevronDown size={16} className={showDirections ? 'rotated' : ''} />
                    </button>
                    <Collapse in={showDirections}>
                      <ol className="directions-list">
                        {plan.directions.map((direction, i) => (
                          <li key={i}>
                            <span>{direction.instruction}</span>
                            <strong>{direction.miles.toFixed(1)} mi</strong>
                          </li>
                        ))}
                      </ol>
                    </Collapse>
                  </div>
                </>
              )}
            </>
          ) : (
            plan && (
              <div className="logs-panel">
                <div className="log-controls">
                  <div>
                    <h3>Daily log sheets</h3>
                    <p>Home-terminal time · Planned duty status</p>
                  </div>
                  <div className="day-switcher">
                    <IconButton
                      aria-label="Previous log day"
                      disabled={day === 0}
                      onClick={() => setDay((v) => v - 1)}
                    >
                      <ChevronLeft size={20} />
                    </IconButton>
                    <span>
                      Day {day + 1} of {plan.logs.length}
                    </span>
                    <IconButton
                      aria-label="Next log day"
                      disabled={day === plan.logs.length - 1}
                      onClick={() => setDay((v) => v + 1)}
                    >
                      <ChevronRight size={20} />
                    </IconButton>
                  </div>
                </div>
                <LogSheet
                  log={plan.logs[day]}
                  plan={plan}
                  selected={selected}
                  onSelect={setSelected}
                />
                <p className="log-disclaimer">
                  Off-duty time outside this trip is assumed. Unprovided driver details remain blank
                  in the actual record; these forecasts are not signed or certified.
                </p>
              </div>
            )
          )}
          <footer className="workspace-footer">
            <span>Built for the road ahead.</span>
            <button onClick={() => setAssumptions(true)}>Assumptions & limitations</button>
          </footer>
        </section>
      </main>
      <Dialog open={assumptions} onClose={() => setAssumptions(false)} maxWidth="sm" fullWidth>
        <DialogTitle className="dialog-heading">
          How this trip is planned
          <IconButton aria-label="Close planning guide" onClick={() => setAssumptions(false)}>
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="guide-content">
            <h3>One driver. Clear assumptions.</h3>
            <p>
              Property-carrying driver, 70 hours in 8 days, starting after 10 consecutive hours off
              duty. Daily driving clocks are fresh; your entered cycle usage remains.
            </p>
            <h3>The clocks we check</h3>
            <ul>
              <li>11 hours driving within a 14-hour window.</li>
              <li>
                30 minutes without driving after 8 cumulative driving hours. Loading and fueling can
                satisfy this interruption.
              </li>
              <li>
                Driving stops when cycle capacity is exhausted. A 34-hour restart restores the
                cycle; unknown historical hours do not roll off.
              </li>
            </ul>
            <h3>Stops and route estimates</h3>
            <p>
              Pickup and delivery each take one hour. The truck starts fueled; a 30-minute fuel stop
              is scheduled at most every 1,000 miles. Scheduled 10-hour rests and 34-hour restarts
              are recorded in the sleeper berth; shorter breaks remain off duty. No split-sleeper or
              special exceptions are used.
            </p>
            <p>
              OSRM supplies road geometry with a car profile. We use a 55 mph planning ceiling,
              without live traffic or truck-restriction verification. Stop coordinates are
              approximate, not confirmed facilities.
            </p>
            <h3>Daily logs</h3>
            <p>
              All sheets use your home-terminal time zone. Pre-trip and post-trip portions are
              assumed off duty. Daily mileage is estimated from driving time. Trips crossing a
              daylight-saving change are currently rejected. These are planned logs, not an actual
              ELD record or a signed certification.
            </p>
            <p className="guide-source">
              Sources:{' '}
              <a
                href="https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"
                target="_blank"
                rel="noreferrer"
              >
                FMCSA HOS summary
              </a>{' '}
              ·{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>{' '}
              · Photon · OSRM. Public map services are best-effort and may be temporarily
              unavailable.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      {plan && (
        <div className="print-only">
          {plan.logs.map((log) => (
            <LogSheet
              key={log.date}
              log={log}
              plan={plan}
              selected={null}
              onSelect={() => undefined}
            />
          ))}
          <section className="print-assumptions">
            <h2>Planning assumptions</h2>
            {plan.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
