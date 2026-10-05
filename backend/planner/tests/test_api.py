from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from planner.providers import ProviderError
from planner.serializers import PlanSerializer
from planner.tests.test_scheduler import A, B, C, legs

PAYLOAD = {
    "current": {"label": "Dallas, TX", "coordinates": A},
    "pickup": {"label": "St. Louis, MO", "coordinates": B},
    "dropoff": {"label": "Chicago, IL", "coordinates": C},
    "cycle_used": 12,
    "departure": "2026-10-05T08:00",
    "timezone": "America/Chicago",
}


class ApiTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_health(self):
        self.assertEqual(self.client.get("/api/health/").json(), {"status": "ok"})

    @patch("planner.views.route_trip")
    def test_plan_contract(self, route):
        route.return_value = (legs(), {"type": "LineString", "coordinates": [A, B, C]}, [])
        response = self.client.post("/api/plan/", PAYLOAD, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["validation"]["passed"])
        self.assertEqual(data["summary"]["cycle_remaining"], 50)
        self.assertEqual(data["summary"]["miles"], 300)
        self.assertEqual(data["events"][0]["start"], "2026-10-05T13:00:00+00:00")
        self.assertEqual(data["logs"][0]["date"], "2026-10-05")

    def test_rejects_invalid_hours_and_coordinates_before_provider(self):
        for value in (-1, 71, "NaN", "Infinity"):
            response = self.client.post(
                "/api/plan/", {**PAYLOAD, "cycle_used": value}, content_type="application/json"
            )
            self.assertEqual(response.status_code, 400)
        response = self.client.post(
            "/api/plan/",
            {**PAYLOAD, "current": {"label": "Other", "coordinates": [74, 31]}},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    @patch("planner.views.route_trip", side_effect=ProviderError("Route service unavailable"))
    def test_provider_error_is_actionable(self, route):
        response = self.client.post("/api/plan/", PAYLOAD, content_type="application/json")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "Route service unavailable")

    def test_ambiguous_and_nonexistent_departure_times_rejected(self):
        for departure in ("2026-11-01T01:30", "2026-03-08T02:30"):
            serializer = PlanSerializer(data={**PAYLOAD, "departure": departure})
            self.assertFalse(serializer.is_valid())
            self.assertIn("departure", serializer.errors)

    def test_search_requires_a_useful_query(self):
        self.assertEqual(self.client.get("/api/locations/?q=a").status_code, 400)
