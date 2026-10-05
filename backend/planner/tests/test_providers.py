from unittest.mock import patch

from django.test import SimpleTestCase

from planner.providers import ProviderError, route_trip, search_locations
from planner.tests.test_api import PAYLOAD


class ProviderBoundaryTests(SimpleTestCase):
    @patch("planner.providers.fetch_json", return_value={"code": "Ok", "routes": [{}]})
    def test_malformed_route_has_a_controlled_error(self, fetch):
        with self.assertRaises(ProviderError):
            route_trip([PAYLOAD[key] for key in ("current", "pickup", "dropoff")])

    @patch("planner.providers.fetch_json")
    def test_geocoder_preserves_address_number_and_removes_duplicate_labels(self, fetch):
        feature = {
            "properties": {
                "countrycode": "US",
                "housenumber": "123",
                "street": "Main Street",
                "city": "Dallas",
                "state": "Texas",
            },
            "geometry": {"coordinates": [-96.8, 32.7]},
        }
        fetch.return_value = {"features": [feature, feature]}
        results = search_locations("123 Main Street Dallas")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["label"], "123 Main Street, Dallas, Texas")
