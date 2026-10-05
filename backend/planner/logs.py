from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from .scheduler import Event


def daily_logs(events: list[Event], zone_name: str) -> list[dict]:
    zone = ZoneInfo(zone_name)
    day = events[0].start.astimezone(zone).date()
    last = (events[-1].end - timedelta(microseconds=1)).astimezone(zone).date()
    days = []
    while day <= last:
        start = datetime.combine(day, time(), zone).astimezone(timezone.utc)
        end = datetime.combine(day + timedelta(days=1), time(), zone).astimezone(timezone.utc)
        if (end - start).total_seconds() != 86400:
            raise ValueError(
                "This trip crosses a daylight-saving clock change. Choose a departure that avoids the transition; DST log days are not supported in this version."
            )
        entries = []
        totals = {"off_duty": 0.0, "sleeper": 0.0, "driving": 0.0, "on_duty": 0.0}
        miles = 0.0
        cursor = start
        for event_index, event in enumerate(events):
            left, right = max(start, event.start), min(end, event.end)
            if right <= left:
                continue
            if left > cursor:
                entries.append(
                    {
                        "event_id": None,
                        "status": "off_duty",
                        "start_minute": (cursor - start).total_seconds() / 60,
                        "end_minute": (left - start).total_seconds() / 60,
                        "location": events[0].location,
                        "reason": "Assumed off duty before departure",
                        "kind": "padding",
                    }
                )
                totals["off_duty"] += (left - cursor).total_seconds() / 3600
            entries.append(
                {
                    "event_id": event.id,
                    "status": event.status,
                    "start_minute": (left - start).total_seconds() / 60,
                    "end_minute": (right - start).total_seconds() / 60,
                    "location": event.location,
                    "kind": event.kind,
                    "reason": event.reason,
                    "duty_change": event_index > 0
                    and events[event_index - 1].status != event.status
                    and event.start == left,
                    "continues": event.start < start,
                }
            )
            totals[event.status] += (right - left).total_seconds() / 3600
            miles += (
                event.miles
                * (right - left).total_seconds()
                / (event.end - event.start).total_seconds()
            )
            cursor = right
        if cursor < end:
            entries.append(
                {
                    "event_id": None,
                    "status": "off_duty",
                    "start_minute": (cursor - start).total_seconds() / 60,
                    "end_minute": 1440,
                    "location": events[-1].location,
                    "reason": "Assumed off duty after trip completion",
                    "kind": "padding",
                }
            )
            totals["off_duty"] += (end - cursor).total_seconds() / 3600
        days.append(
            {
                "date": day.isoformat(),
                "timezone": zone_name,
                "entries": entries,
                "totals": totals,
                "miles": miles,
            }
        )
        day += timedelta(days=1)
    return days
