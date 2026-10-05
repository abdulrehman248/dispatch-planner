"""Provider-independent routing primitives. Coordinates are longitude, latitude."""

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt

Point = tuple[float, float]


def distance(a: Point, b: Point) -> float:
    lat1, lat2 = radians(a[1]), radians(b[1])
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin(radians(b[0] - a[0]) / 2) ** 2
    return 3958.7613 * 2 * asin(min(1, sqrt(h)))


@dataclass(frozen=True)
class Segment:
    seconds: float
    miles: float
    geometry: list[Point]
    road: str = "Route"
    instruction: str = "Continue"

    def point_at(self, fraction: float) -> Point:
        if len(self.geometry) == 1:
            return self.geometry[0]
        lengths = [distance(a, b) for a, b in zip(self.geometry, self.geometry[1:])]
        target = max(0, min(1, fraction)) * sum(lengths)
        for a, b, length in zip(self.geometry, self.geometry[1:], lengths):
            if target <= length and length:
                ratio = target / length
                return (a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio)
            target -= length
        return self.geometry[-1]


@dataclass(frozen=True)
class Leg:
    origin: str
    destination: str
    segments: list[Segment]
    endpoint: Point
