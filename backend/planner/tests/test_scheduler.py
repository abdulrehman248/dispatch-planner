import random
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest import TestCase

from planner.domain import Leg, Segment
from planner.logs import daily_logs
from planner.scheduler import Scheduler, validate_schedule

START = datetime(2026, 10, 5, 13, tzinfo=timezone.utc)
A, B, C = (-96.8, 32.7), (-90.2, 38.6), (-87.6, 41.8)


def legs(hours1=2, hours2=4, speed=50):
    return [
        Leg(
            "Dallas, TX",
            "St. Louis, MO",
            [Segment(hours1 * 3600, hours1 * speed, [A, B], "I-35")] if hours1 else [],
            B,
        ),
        Leg(
            "St. Louis, MO",
            "Chicago, IL",
            [Segment(hours2 * 3600, hours2 * speed, [B, C], "I-55")] if hours2 else [],
            C,
        ),
    ]


def plan(hours1=2, hours2=4, cycle=0, start=START, speed=50):
    scheduler = Scheduler(start, cycle, A, "Dallas, TX")
    return scheduler.plan(legs(hours1, hours2, speed))


class SchedulingTests(TestCase):
    def test_short_trip_has_exact_service_time_and_cycle(self):
        events = plan(cycle=12)
        self.assertEqual([e.kind for e in events], ["drive", "pickup", "drive", "dropoff"])
        self.assertEqual(events[-1].cycle_used, 20)
        self.assertEqual((events[-1].end - START).total_seconds(), 8 * 3600)

    def test_pickup_satisfies_driving_break_without_resetting_daily_drive(self):
        events = plan(7, 4)
        self.assertNotIn("break", [e.kind for e in events])
        self.assertEqual(
            sum((e.end - e.start).total_seconds() for e in events if e.kind == "drive"), 11 * 3600
        )
        self.assertFalse(validate_schedule(events, 0))

    def test_eight_hour_boundary_does_not_add_break_if_no_more_driving(self):
        events = plan(8, 0)
        self.assertNotIn("break", [e.kind for e in events])

    def test_break_is_required_before_driving_beyond_eight_hours(self):
        events = plan(9, 0)
        self.assertEqual([e.kind for e in events], ["drive", "break", "drive", "pickup", "dropoff"])
        self.assertEqual((events[0].end - events[0].start).total_seconds(), 8 * 3600)

    def test_daily_rest_after_eleven_hours(self):
        events = plan(12, 1)
        rest = next(e for e in events if e.kind == "rest")
        self.assertEqual((rest.end - rest.start).total_seconds(), 10 * 3600)
        self.assertEqual(rest.status, "sleeper")
        self.assertGreater(rest.cycle_used, 0)
        self.assertFalse(validate_schedule(events, 0))

    def test_cycle_68_forces_restart_after_two_driving_hours(self):
        events = plan(4, 2, cycle=68)
        self.assertEqual(events[0].miles, 100)
        self.assertEqual(events[1].kind, "restart")
        self.assertEqual(events[1].status, "sleeper")
        self.assertEqual(events[1].cycle_used, 0)
        self.assertEqual((events[1].end - events[1].start).total_seconds(), 34 * 3600)
        self.assertFalse(validate_schedule(events, 68))

    def test_exhausted_cycle_restarts_before_first_drive(self):
        events = plan(cycle=70)
        self.assertEqual(events[0].kind, "restart")
        self.assertFalse(validate_schedule(events, 70))

    def test_nondriving_work_can_continue_beyond_cycle_limit(self):
        events = plan(1, 0, cycle=69)
        self.assertNotIn("restart", [e.kind for e in events])
        self.assertEqual(events[-1].cycle_used, 72)
        self.assertFalse(validate_schedule(events, 69))

    def test_fueling_persists_across_pickup(self):
        events = plan(12, 14)
        fuel = next(e for e in events if e.kind == "fuel")
        miles = sum(e.miles for e in events if e.end <= fuel.start)
        self.assertAlmostEqual(miles, 1000)
        self.assertEqual(fuel.status, "on_duty")
        self.assertFalse(validate_schedule(events, 0))

    def test_fourteen_hour_window_includes_nondriving_work(self):
        scheduler = Scheduler(START, 0, A, "Dallas")
        scheduler.add("pickup", "on_duty", 5 * 3600, "Synthetic extended loading")
        events = scheduler.plan(legs(10, 0))
        rest = next(e for e in events if e.kind == "rest")
        self.assertIn("14-hour", rest.reason)
        self.assertFalse(validate_schedule(events, 0))

    def test_multiple_constraints_still_produce_continuous_timeline(self):
        rng = random.Random(17)
        for _ in range(100):
            cycle = round(rng.uniform(0, 70), 2)
            events = plan(
                rng.uniform(0.1, 40), rng.uniform(0.1, 40), cycle, speed=rng.uniform(20, 55)
            )
            self.assertFalse(validate_schedule(events, cycle))

    def test_validator_detects_tampered_overlong_drive(self):
        events = deepcopy(plan())
        events[0].end = events[0].start + timedelta(hours=12)
        errors = validate_schedule(events, 0)
        self.assertIn("11-hour driving limit exceeded.", errors)
        self.assertIn("Driving break overdue.", errors)

    def test_midnight_does_not_reset_cycle_or_drive(self):
        events = plan(9, 1, cycle=10, start=datetime(2026, 10, 5, 23, tzinfo=timezone.utc))
        self.assertEqual(events[-1].cycle_used, 22)
        self.assertEqual(len(daily_logs(events, "America/Chicago")), 2)
        self.assertEqual(len([e for e in events if e.kind == "break"]), 1)

    def test_logs_cover_each_day_and_reconcile_mileage(self):
        events = plan(24, 25, cycle=64)
        logs = daily_logs(events, "America/Chicago")
        self.assertGreater(len(logs), 3)
        for log in logs:
            self.assertAlmostEqual(sum(log["totals"].values()), 24)
            self.assertEqual(log["entries"][0]["start_minute"], 0)
            self.assertEqual(log["entries"][-1]["end_minute"], 1440)
        self.assertAlmostEqual(sum(log["miles"] for log in logs), sum(e.miles for e in events))

    def test_unsupported_dst_day_is_explicit(self):
        events = plan(start=datetime(2026, 11, 1, 6, tzinfo=timezone.utc))
        with self.assertRaisesRegex(ValueError, "daylight-saving"):
            daily_logs(events, "America/Chicago")

    def test_zero_distance_still_includes_pickup_and_delivery(self):
        events = plan(0, 0)
        self.assertEqual([e.kind for e in events], ["pickup", "dropoff"])
        self.assertFalse(validate_schedule(events, 0))

    def test_quarter_hour_schedule_preserves_miles_and_limits(self):
        events = plan(
            7.03, 15.11, cycle=68.93, start=START + timedelta(minutes=3, seconds=17), speed=53
        )
        self.assertEqual(events[0].start, START + timedelta(minutes=15))
        for event in events:
            self.assertEqual(event.start.minute % 15, 0)
            self.assertEqual(event.end.minute % 15, 0)
            self.assertEqual(event.start.second, 0)
            self.assertEqual(event.end.second, 0)
        self.assertAlmostEqual(sum(e.miles for e in events), (7.03 + 15.11) * 53)
        self.assertFalse(validate_schedule(events, 68.93))
        for log in daily_logs(events, "America/Chicago"):
            self.assertAlmostEqual(sum(log["totals"].values()), 24)
            for entry in log["entries"]:
                self.assertEqual(entry["start_minute"] % 15, 0)
                self.assertEqual(entry["end_minute"] % 15, 0)

    def test_rounds_whole_leg_not_individual_road_steps(self):
        route = legs(0, 0)
        route[0].segments.extend([Segment(60, 0.5, [A, B], "Road")] * 17)
        events = Scheduler(START, 0, A, "Dallas").plan(route)
        self.assertEqual((events[0].end - events[0].start).total_seconds(), 1800)
        self.assertAlmostEqual(events[0].miles, 8.5)

    def test_daily_entries_retain_reason_and_midnight_transition(self):
        events = plan(1, 1, start=datetime(2026, 10, 6, 4, tzinfo=timezone.utc))
        logs = daily_logs(events, "America/Chicago")
        midnight = logs[1]["entries"][0]
        self.assertEqual(midnight["kind"], "pickup")
        self.assertTrue(midnight["duty_change"])
        self.assertIn("loading", midnight["reason"])
        continued = daily_logs(
            plan(9, 1, start=datetime(2026, 10, 6, 4, tzinfo=timezone.utc)), "America/Chicago"
        )[1]["entries"][0]
        self.assertTrue(continued["continues"])
        self.assertFalse(continued["duty_change"])
