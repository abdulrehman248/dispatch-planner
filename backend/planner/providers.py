"""Small, replaceable adapters for public OSM-based demonstration services."""

import hashlib
import math
import threading
import time

import requests
from django.conf import settings
from django.core.cache import cache

from .domain import Leg, Segment


class ProviderError(Exception):
    pass


_provider_lock = threading.Lock()
_last_request = 0.0


def fetch_json(url, params, ttl=86400):
    global _last_request
    key = hashlib.sha256((url + repr(sorted(params.items()))).encode()).hexdigest()
    cached = cache.get(key)
    if cached is not None:
        return cached
    # One gunicorn worker is intentional: it provides a single outbound rate gate.
    with _provider_lock:
        cached = cache.get(key)
        if cached is not None:
            return cached
        time.sleep(max(0, 1.05 - (time.monotonic() - _last_request)))
        _last_request = time.monotonic()
        try:
            response = requests.get(
                url,
                params=params,
                headers={"User-Agent": settings.PROVIDER_USER_AGENT},
                timeout=(5, 25),
            )
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError("Unexpected provider response")
        except (requests.RequestException, ValueError) as exc:
            raise ProviderError(
                "The map provider is temporarily unavailable. Please try again shortly."
            ) from exc
        cache.set(key, data, ttl)
        return data


def search_locations(query):
    data = fetch_json(
        settings.PHOTON_URL.rstrip("/") + "/api/",
        {
            "q": query,
            "limit": 8,
            "lang": "en",
            "bbox": "-125,24,-66,50",
        },
    )
    results = []
    for feature in data.get("features", []):
        p = feature["properties"]
        if p.get("countrycode", "").upper() != "US":
            continue
        address = " ".join(str(part) for part in (p.get("housenumber"), p.get("street")) if part)
        parts = [p.get("name"), address, p.get("city"), p.get("state")]
        label = ", ".join(dict.fromkeys(str(part) for part in parts if part))
        coordinates = feature["geometry"]["coordinates"]
        if label and not any(x["label"] == label for x in results):
            results.append({"label": label, "coordinates": coordinates})
    return results[:5]


def route_trip(locations):
    coords = ";".join(f"{p['coordinates'][0]:.6f},{p['coordinates'][1]:.6f}" for p in locations)
    data = fetch_json(
        settings.OSRM_URL.rstrip("/") + f"/route/v1/driving/{coords}",
        {
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
            "alternatives": "false",
            "continue_straight": "true",
        },
        ttl=3600,
    )
    if data.get("code") != "Ok" or not data.get("routes"):
        raise ProviderError(
            "No drivable route was found between these locations. Try nearby road-accessible addresses."
        )
    try:
        return normalize_route(data, locations)
    except (KeyError, IndexError, TypeError, ValueError, OverflowError) as exc:
        raise ProviderError(
            "The route provider returned incomplete data. Please try again."
        ) from exc


def normalize_route(data, locations):
    route = data["routes"][0]
    legs = []
    directions = []
    for index, leg in enumerate(route["legs"]):
        segments = []
        for step in leg["steps"]:
            miles = step["distance"] / 1609.344
            if miles < 1e-7:
                continue
            seconds = max(1, math.ceil(step["duration"]), math.ceil(miles / 55 * 3600))
            road = step.get("ref") or step.get("name") or "unnamed road"
            maneuver = step.get("maneuver", {})
            action = maneuver.get("type", "continue").replace("_", " ")
            modifier = maneuver.get("modifier", "")
            instruction = f"{action.capitalize()} {modifier} onto {road}".replace("  ", " ")
            geometry = [tuple(p) for p in step["geometry"]["coordinates"]]
            if not geometry:
                raise ValueError("Missing step geometry")
            segments.append(Segment(seconds, miles, geometry, road, instruction))
            directions.append({"leg": index, "instruction": instruction, "miles": miles})
        legs.append(
            Leg(
                locations[index]["label"],
                locations[index + 1]["label"],
                segments,
                tuple(locations[index + 1]["coordinates"]),
            )
        )
    if len(legs) != 2:
        raise ProviderError("The route provider returned an incomplete trip. Please try again.")
    if not route["geometry"]["coordinates"]:
        raise ValueError("Missing route geometry")
    return legs, route["geometry"], directions
