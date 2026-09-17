import asyncio
from dataclasses import dataclass, field
from datetime import date

import httpx
from shapely.geometry import shape
from shapely.geometry.polygon import orient

from app.config import settings

SPARSE_THRESHOLD = 100
MAX_TAXA = 6
SPECIES_FACET_LIMIT = 500
YEAR_FACET_LIMIT = 60
EARLIEST_YEAR = 2000


@dataclass
class BiodiversityResult:
    occurrence_total: int = 0
    species_richness: int = 0
    species_capped: bool = False
    yearly: list[tuple[int, int]] = field(default_factory=list)
    taxa: list[tuple[str, int]] = field(default_factory=list)

    @property
    def is_sparse(self) -> bool:
        return self.occurrence_total < SPARSE_THRESHOLD


def geometry_to_wkt(geometry: dict) -> str:
    polygon = shape(geometry)

    if not polygon.is_valid:
        polygon = polygon.buffer(0)

    return orient(polygon, sign=1.0).wkt


async def _resolve_taxon_name(client: httpx.AsyncClient, key: str) -> str:
    try:
        response = await client.get(f"{settings.gbif_api_url}/species/{key}")
        response.raise_for_status()
        return response.json().get("scientificName") or f"Taxon {key}"
    except (httpx.HTTPError, ValueError, KeyError):
        return f"Taxon {key}"


def _facet_counts(payload: dict, field_name: str) -> list[tuple[str, int]]:
    for facet in payload.get("facets", []):
        if facet.get("field") == field_name:
            return [(c["name"], c["count"]) for c in facet.get("counts", [])]
    return []


async def fetch_biodiversity(geometry: dict) -> BiodiversityResult:
    wkt = geometry_to_wkt(geometry)
    current_year = date.today().year

    params = [
        ("geometry", wkt),
        ("limit", 0),
        ("hasCoordinate", "true"),
        ("year", f"{EARLIEST_YEAR},{current_year}"),
        ("facet", "YEAR"),
        ("YEAR.facetLimit", YEAR_FACET_LIMIT),
        ("facet", "CLASS_KEY"),
        ("CLASS_KEY.facetLimit", MAX_TAXA),
        ("facet", "SPECIES_KEY"),
        ("SPECIES_KEY.facetLimit", SPECIES_FACET_LIMIT),
    ]

    timeout = httpx.Timeout(settings.external_api_timeout_seconds)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(f"{settings.gbif_api_url}/occurrence/search", params=params)
        response.raise_for_status()
        payload = response.json()

        total = int(payload.get("count", 0))

        yearly = sorted(
            (
                (int(name), count)
                for name, count in _facet_counts(payload, "YEAR")
                if name.isdigit()
            ),
            key=lambda item: item[0],
        )

        species = _facet_counts(payload, "SPECIES_KEY")
        class_counts = _facet_counts(payload, "CLASS_KEY")[:MAX_TAXA]

        names = await asyncio.gather(*(_resolve_taxon_name(client, key) for key, _ in class_counts))

    return BiodiversityResult(
        occurrence_total=total,
        species_richness=len(species),
        species_capped=len(species) >= SPECIES_FACET_LIMIT,
        yearly=yearly,
        taxa=[(name, count) for name, (_, count) in zip(names, class_counts, strict=True)],
    )
