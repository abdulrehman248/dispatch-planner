import logging

from rest_framework.response import Response
from rest_framework.views import APIView

from .logs import daily_logs
from .providers import ProviderError, route_trip, search_locations
from .scheduler import Scheduler, validate_schedule
from .serializers import PlanSerializer

logger = logging.getLogger(__name__)


class HealthView(APIView):
    throttle_classes = []

    def get(self, request):
        return Response({"status": "ok"})


class LocationView(APIView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not 3 <= len(query) <= 180:
            return Response(
                {"detail": "Enter a city or address between 3 and 180 characters."}, status=400
            )
        try:
            return Response({"results": search_locations(query)})
        except ProviderError as exc:
            return Response({"detail": str(exc)}, status=503)


class PlanView(APIView):
    def post(self, request):
        serializer = PlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        locations = [data[name] for name in ("current", "pickup", "dropoff")]
        try:
            legs, geometry, directions = route_trip(locations)
            scheduler = Scheduler(
                data["departure_utc"],
                float(data["cycle_used"]),
                tuple(locations[0]["coordinates"]),
                locations[0]["label"],
            )
            events = scheduler.plan(legs)
            violations = validate_schedule(events, float(data["cycle_used"]))
            if violations:
                logger.error("Schedule validation failed: %s", violations)
                return Response(
                    {
                        "detail": "The generated schedule did not pass validation. Please change the trip and try again."
                    },
                    status=422,
                )
            logs = daily_logs(events, data["timezone"])
        except ProviderError as exc:
            return Response({"detail": str(exc)}, status=503)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        drive_hours = sum(
            (e.end - e.start).total_seconds() / 3600 for e in events if e.status == "driving"
        )
        return Response(
            {
                "locations": locations,
                "geometry": geometry,
                "directions": directions,
                "events": [e.serialize() for e in events],
                "logs": logs,
                "timezone": data["timezone"],
                "initial_cycle_used": float(data["cycle_used"]),
                "metadata": {
                    key: data.get(key, "") for key in ("driver", "carrier", "vehicle", "shipping")
                },
                "summary": {
                    "miles": sum(e.miles for e in events),
                    "driving_hours": drive_hours,
                    "elapsed_hours": (events[-1].end - events[0].start).total_seconds() / 3600,
                    "arrival": next(e.start.isoformat() for e in events if e.kind == "dropoff"),
                    "completion": events[-1].end.isoformat(),
                    "days": len(logs),
                    "cycle_remaining": max(0, 70 - events[-1].cycle_used),
                    "stops": sum(e.kind not in ("drive", "pickup", "dropoff") for e in events),
                },
                "warnings": [
                    "Planned logs, not a record of actual duty. Before and after the trip, off-duty time is assumed.",
                    "Prior cycle hours are retained until a 34-hour restart. Historical daily recaps are not calculated.",
                    "Road routing uses a car profile, not verified truck restrictions. Driving estimates use a 55 mph ceiling and exclude live traffic.",
                    "Fuel and rest markers are approximate points along the route, not verified facilities. Confirm safe stopping locations before travel.",
                    "Daily mileage is estimated by apportioning each continuous driving period by time.",
                ],
                "validation": {
                    "passed": True,
                    "checks": [
                        "11-hour driving",
                        "14-hour window",
                        "30-minute interruption",
                        "70-hour cycle",
                        "1,000-mile fuel interval",
                        "Continuous timeline",
                    ],
                },
            }
        )
