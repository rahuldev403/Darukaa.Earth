from dataclasses import dataclass, field
from datetime import date

import httpx
from shapely.geometry import shape

from app.config import settings

ANNUAL_MEAN_KEY_SUFFIX = "13"
FILL_VALUE = -999.0
YEARS_OF_HISTORY = 10


@dataclass
class ClimateResult:
    temperature: list[tuple[date, float]] = field(default_factory=list)
    precipitation: list[tuple[date, float]] = field(default_factory=list)


def _parse_monthly(values: dict) -> list[tuple[date, float]]:
    points: list[tuple[date, float]] = []

    for key, value in (values or {}).items():
        if len(key) != 6 or not key.isdigit():
            continue
        if key.endswith(ANNUAL_MEAN_KEY_SUFFIX):
            continue
        if value is None or float(value) <= FILL_VALUE:
            continue

        year, month = int(key[:4]), int(key[4:])
        if not 1 <= month <= 12:
            continue

        points.append((date(year, month, 1), round(float(value), 2)))

    return sorted(points, key=lambda item: item[0])


async def fetch_climate(geometry: dict) -> ClimateResult:
    centroid = shape(geometry).centroid
    end_year = date.today().year - 1
    start_year = end_year - YEARS_OF_HISTORY + 1

    params = {
        "parameters": "T2M,PRECTOTCORR",
        "community": "AG",
        "latitude": round(centroid.y, 4),
        "longitude": round(centroid.x, 4),
        "start": start_year,
        "end": end_year,
        "format": "JSON",
    }

    timeout = httpx.Timeout(settings.external_api_timeout_seconds)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(settings.nasa_power_api_url, params=params)
        response.raise_for_status()
        payload = response.json()

    parameters = payload.get("properties", {}).get("parameter", {})

    return ClimateResult(
        temperature=_parse_monthly(parameters.get("T2M")),
        precipitation=_parse_monthly(parameters.get("PRECTOTCORR")),
    )
