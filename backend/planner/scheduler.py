"""Deterministic HOS planning with conservative aggregate cycle accounting.

All elapsed durations are seconds on an absolute timeline. Historical cycle
usage never earns an inferred recap. A 34-hour restart clears that usage.
"""

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta

from .domain import Leg, Point

HOUR = 3600
EPSILON = 1e-6


@dataclass
class Event:
    id: int
    kind: str
    status: str
    start: datetime
    end: datetime
    miles: float
    location: str
    coordinates: Point
    end_coordinates: Point
    reason: str
    leg: int
    cycle_used: float
    driving_used: float
    shift_elapsed: float

    def serialize(self):
        result = asdict(self)
        result.update(start=self.start.isoformat(), end=self.end.isoformat())
        return result


class Scheduler:
    def __init__(self, departure: datetime, cycle_hours: float, origin: Point, label: str):
        self.now = departure
        self.cycle = cycle_hours * HOUR
        self.shift_start: datetime | None = None
        self.driving = 0.0
        self.since_break = 0.0
        self.since_fuel = 0.0
        self.position = origin
        self.label = label
        self.leg_index = 0
        self.events: list[Event] = []

    @property
    def shift_elapsed(self):
        return (self.now - self.shift_start).total_seconds() if self.shift_start else 0.0

    def add(self, kind, status, seconds, reason, miles=0.0, endpoint=None):
        start = self.now
        origin = self.position
        if status in ("driving", "on_duty"):
            if self.shift_start is None:
                self.shift_start = start
            self.cycle += seconds
        if status == "driving":
            self.driving += seconds
            self.since_break += seconds
            self.since_fuel += miles
        elif seconds >= 30 * 60 - EPSILON:
            self.since_break = 0.0
        self.now += timedelta(seconds=seconds)
        if status == "off_duty" and seconds >= 10 * HOUR:
            self.shift_start = None
            self.driving = 0.0
        if status == "off_duty" and seconds >= 34 * HOUR:
            self.cycle = 0.0
        if kind == "fuel":
            self.since_fuel = 0.0
        self.position = endpoint or self.position
        # Merge provider road steps into continuous driving periods, not hundreds of log entries.
        if (
            self.events
            and kind == "drive"
            and self.events[-1].kind == "drive"
            and self.events[-1].leg == self.leg_index
        ):
            event = self.events[-1]
            event.end = self.now
            event.miles += miles
            event.end_coordinates = self.position
            event.cycle_used = self.cycle / HOUR
            event.driving_used = self.driving / HOUR
            event.shift_elapsed = self.shift_elapsed / HOUR
            return
        self.events.append(
            Event(
                len(self.events),
                kind,
                status,
                start,
                self.now,
                miles,
                self.label,
                origin,
                self.position,
                reason,
                self.leg_index,
                self.cycle / HOUR,
                self.driving / HOUR,
                self.shift_elapsed / HOUR,
            )
        )

    def prepare_to_drive(self):
        if self.cycle >= 70 * HOUR - EPSILON:
            self.add(
                "restart",
                "off_duty",
                34 * HOUR,
                "Cycle capacity exhausted. A 34-hour restart restores 70 hours; no historical recaps are assumed.",
            )
        elif self.driving >= 11 * HOUR - EPSILON or self.shift_elapsed >= 14 * HOUR - EPSILON:
            reason = (
                "11-hour driving limit reached."
                if self.driving >= 11 * HOUR - EPSILON
                else "14-hour driving window reached."
            )
            self.add("rest", "off_duty", 10 * HOUR, reason + " Take 10 consecutive hours off duty.")
        elif self.since_fuel >= 1000 - EPSILON:
            self.add(
                "fuel",
                "on_duty",
                30 * 60,
                "Fuel interval reached. 30 minutes on duty also satisfies the driving-break requirement.",
            )
        elif self.since_break >= 8 * HOUR - EPSILON:
            self.add(
                "break",
                "off_duty",
                30 * 60,
                "8 cumulative driving hours since the last qualifying interruption. Take 30 minutes without driving.",
            )

    def plan(self, legs: list[Leg]) -> list[Event]:
        for index, leg in enumerate(legs):
            self.leg_index = index
            for segment in leg.segments:
                consumed = 0.0
                while consumed < segment.seconds - EPSILON:
                    # Recheck after an inserted event: fueling can exhaust the cycle or window.
                    before = len(self.events)
                    self.prepare_to_drive()
                    if len(self.events) != before:
                        continue
                    speed = segment.miles / segment.seconds
                    fuel_seconds = (1000 - self.since_fuel) / speed if speed else float("inf")
                    seconds = min(
                        segment.seconds - consumed,
                        11 * HOUR - self.driving,
                        14 * HOUR - self.shift_elapsed,
                        70 * HOUR - self.cycle,
                        8 * HOUR - self.since_break,
                        fuel_seconds,
                    )
                    if seconds <= EPSILON:
                        raise ValueError("Unable to advance the schedule.")
                    consumed += seconds
                    endpoint = segment.point_at(consumed / segment.seconds)
                    self.add(
                        "drive",
                        "driving",
                        seconds,
                        f"Drive to {leg.destination}.",
                        seconds * speed,
                        endpoint,
                    )
                    self.label = (
                        f"Along {segment.road} · {endpoint[1]:.4f}, {endpoint[0]:.4f} (approximate)"
                    )
            self.position = leg.endpoint
            self.label = leg.destination
            kind = "pickup" if index == 0 else "dropoff"
            # Non-driving work is allowed beyond driving limits. Recheck before the next drive.
            self.add(
                kind,
                "on_duty",
                HOUR,
                f"One hour for {'loading' if index == 0 else 'unloading'}. Counts toward cycle hours and satisfies a driving break.",
            )
        return self.events


def validate_schedule(events: list[Event], initial_cycle: float) -> list[str]:
    """Replay the output independently; never return an unchecked plan to clients."""
    errors = []
    cycle = initial_cycle * HOUR
    drive = since_break = fuel = nondriving = off = 0.0
    shift = None
    previous_end = None
    for event in events:
        seconds = (event.end - event.start).total_seconds()
        if seconds <= 0 or (previous_end is not None and event.start != previous_end):
            errors.append("Timeline has a gap, overlap, or nonpositive event.")
        previous_end = event.end
        if event.status == "off_duty":
            off += seconds
            nondriving += seconds
            if off >= 10 * HOUR - 0.01:
                drive = 0
                shift = None
            if off >= 34 * HOUR - 0.01:
                cycle = 0
        else:
            off = 0
            if shift is None:
                shift = event.start
            cycle += seconds
            if event.status == "driving":
                drive += seconds
                since_break += seconds
                fuel += event.miles
                nondriving = 0
                if drive > 11 * HOUR + 0.01:
                    errors.append("11-hour driving limit exceeded.")
                if (event.end - shift).total_seconds() > 14 * HOUR + 0.01:
                    errors.append("14-hour driving window exceeded.")
                if cycle > 70 * HOUR + 0.01:
                    errors.append("Driving beyond cycle capacity.")
                if since_break > 8 * HOUR + 0.01:
                    errors.append("Driving break overdue.")
                if fuel > 1000 + 0.001:
                    errors.append("Fuel interval exceeded.")
            else:
                nondriving += seconds
        if nondriving >= 1800 - 0.01:
            since_break = 0
        if event.kind == "fuel":
            fuel = 0
    return list(dict.fromkeys(errors))
