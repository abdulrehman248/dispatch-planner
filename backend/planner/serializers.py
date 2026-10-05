from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers


class LocationSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=240)
    coordinates = serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)

    def validate_coordinates(self, value):
        lon, lat = value
        if not (-125 <= lon <= -66 and 24 <= lat <= 50):
            raise serializers.ValidationError("Choose a location in the contiguous United States.")
        return value


class PlanSerializer(serializers.Serializer):
    current = LocationSerializer()
    pickup = LocationSerializer()
    dropoff = LocationSerializer()
    cycle_used = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=70)
    departure = serializers.CharField(max_length=32)
    timezone = serializers.ChoiceField(
        choices=[
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Los_Angeles",
            "America/Phoenix",
        ]
    )
    driver = serializers.CharField(max_length=100, required=False, allow_blank=True)
    carrier = serializers.CharField(max_length=100, required=False, allow_blank=True)
    vehicle = serializers.CharField(max_length=80, required=False, allow_blank=True)
    shipping = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate(self, attrs):
        try:
            local = datetime.fromisoformat(attrs["departure"])
            zone = ZoneInfo(attrs["timezone"])
            if local.tzinfo is not None:
                raise ValueError("Use terminal local time without an offset.")
            first = local.replace(tzinfo=zone, fold=0)
            second = local.replace(tzinfo=zone, fold=1)
            if first.utcoffset() != second.utcoffset():
                raise ValueError(
                    "This local time is ambiguous or does not exist due to daylight saving. Choose another time."
                )
            utc = first.astimezone(timezone.utc)
            if utc.astimezone(zone).replace(tzinfo=None) != local:
                raise ValueError("This local time does not exist.")
            if not 2020 <= local.year <= 2100:
                raise ValueError("Choose a year between 2020 and 2100.")
            attrs["departure_utc"] = utc
        except (ValueError, ZoneInfoNotFoundError) as exc:
            raise serializers.ValidationError({"departure": str(exc)}) from exc
        return attrs
