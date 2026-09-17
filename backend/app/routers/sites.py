import asyncio
import json
from datetime import date

from fastapi import APIRouter, HTTPException, status
from geoalchemy2 import Geography
from geoalchemy2.functions import ST_Area, ST_AsGeoJSON
from shapely.geometry import shape
from sqlalchemy import cast, select
from sqlalchemy.orm import Session

from app.models import Project, Site, SiteMetric
from app.schemas import (
    DataQuality,
    Feature,
    FeatureCollection,
    Kpi,
    Series,
    SeriesPoint,
    SiteAnalytics,
    SiteCreate,
    SiteOut,
    Taxon,
)
from app.security import CurrentUser, DbSession
from app.services.carbon import estimate_carbon
from app.services.gbif import SPARSE_THRESHOLD, fetch_biodiversity
from app.services.nasa_power import fetch_climate

router = APIRouter(tags=["sites"])

TAXON_PREFIX = "taxon:"

METRIC_REGISTRY = {
    "species_occurrences": ("Species Occurrences", "records", "GBIF", False),
    "temperature_c": ("Mean Temperature", "°C", "NASA POWER", False),
    "precipitation_mm": ("Precipitation", "mm/day", "NASA POWER", False),
    "sequestration_projection_tco2e": ("Projected Carbon Stock", "tCO2e", "IPCC Tier 1", True),
}

KPI_REGISTRY = {
    "occurrence_total": ("Occurrence Records", "records", "GBIF", False),
    "species_richness": ("Species Recorded", "species", "GBIF", False),
    "carbon_baseline_tco2e": ("Carbon Stock (baseline)", "tCO2e", "IPCC Tier 1", True),
}


def _owned_site(db: Session, site_id: int, user_id: int) -> Site:
    site = db.scalar(
        select(Site)
        .join(Project, Site.project_id == Project.id)
        .where(Site.id == site_id, Project.owner_id == user_id)
    )
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    return site


def _geometry_of(db: Session, site_id: int) -> dict:
    raw = db.scalar(select(ST_AsGeoJSON(Site.geom)).where(Site.id == site_id))
    return json.loads(raw) if raw else {}


def _area_hectares(db: Session, site_id: int) -> float:
    square_metres = db.scalar(select(ST_Area(cast(Site.geom, Geography))).where(Site.id == site_id))
    return round(float(square_metres or 0.0) / 10_000.0, 4)


async def _ingest(site: Site, geometry: dict, area_ha: float) -> tuple[list[SiteMetric], str]:
    biodiversity, climate = await asyncio.gather(
        fetch_biodiversity(geometry),
        fetch_climate(geometry),
        return_exceptions=True,
    )

    metrics: list[SiteMetric] = []
    failures = 0
    today = date.today()

    def add(metric_type: str, value: float, unit: str, source: str, modeled: bool, on: date):
        metrics.append(
            SiteMetric(
                site_id=site.id,
                date=on,
                metric_type=metric_type,
                value=float(value),
                unit=unit,
                source=source,
                is_modeled=modeled,
            )
        )

    if isinstance(biodiversity, BaseException):
        failures += 1
    else:
        add("occurrence_total", biodiversity.occurrence_total, "records", "GBIF", False, today)
        add("species_richness", biodiversity.species_richness, "species", "GBIF", False, today)

        for year, count in biodiversity.yearly:
            add("species_occurrences", count, "records", "GBIF", False, date(year, 1, 1))

        for name, count in biodiversity.taxa:
            add(f"{TAXON_PREFIX}{name}"[:50], count, "records", "GBIF", False, today)

    if isinstance(climate, BaseException):
        failures += 1
    else:
        for on, value in climate.temperature:
            add("temperature_c", value, "°C", "NASA POWER", False, on)
        for on, value in climate.precipitation:
            add("precipitation_mm", value, "mm/day", "NASA POWER", False, on)

    carbon = estimate_carbon(area_ha)
    add("carbon_baseline_tco2e", carbon.baseline_tco2e, "tCO2e", "IPCC Tier 1", True, today)
    for on, value in carbon.projection:
        add("sequestration_projection_tco2e", value, "tCO2e", "IPCC Tier 1", True, on)

    if failures == 0:
        return metrics, "complete"
    if failures == 2:
        return metrics, "failed"
    return metrics, "partial"


@router.get("/sites", response_model=FeatureCollection)
def list_sites(db: DbSession, user: CurrentUser) -> FeatureCollection:
    rows = db.execute(
        select(Site, Project.name, ST_AsGeoJSON(Site.geom))
        .join(Project, Site.project_id == Project.id)
        .where(Project.owner_id == user.id)
        .order_by(Site.created_at.desc())
    ).all()

    return FeatureCollection(
        features=[
            Feature(
                id=site.id,
                geometry=json.loads(geojson) if geojson else {},
                properties={
                    "id": site.id,
                    "name": site.name,
                    "project_id": site.project_id,
                    "project_name": project_name,
                    "area_ha": round(site.area_ha, 2),
                    "ingest_status": site.ingest_status,
                },
            )
            for site, project_name, geojson in rows
        ]
    )


@router.post(
    "/projects/{project_id}/sites",
    response_model=SiteOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_site(
    project_id: int, payload: SiteCreate, db: DbSession, user: CurrentUser
) -> SiteOut:
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    geometry = payload.geometry.model_dump()

    polygon = shape(geometry)
    if not polygon.is_valid:
        polygon = polygon.buffer(0)
        geometry = polygon.__geo_interface__

    site = Site(
        name=payload.name.strip(),
        project_id=project.id,
        geom=f"SRID=4326;{polygon.wkt}",
        area_ha=0.0,
        ingest_status="pending",
    )
    db.add(site)
    db.flush()

    site.area_ha = _area_hectares(db, site.id)
    db.commit()
    db.refresh(site)

    metrics, ingest_status = await _ingest(site, geometry, site.area_ha)

    db.add_all(metrics)
    site.ingest_status = ingest_status
    db.commit()
    db.refresh(site)

    return SiteOut(
        id=site.id,
        name=site.name,
        project_id=site.project_id,
        project_name=project.name,
        area_ha=round(site.area_ha, 2),
        ingest_status=site.ingest_status,
        created_at=site.created_at,
        geometry=_geometry_of(db, site.id),
    )


@router.get("/sites/{site_id}", response_model=SiteOut)
def get_site(site_id: int, db: DbSession, user: CurrentUser) -> SiteOut:
    site = _owned_site(db, site_id, user.id)
    project = db.get(Project, site.project_id)

    return SiteOut(
        id=site.id,
        name=site.name,
        project_id=site.project_id,
        project_name=project.name if project else None,
        area_ha=round(site.area_ha, 2),
        ingest_status=site.ingest_status,
        created_at=site.created_at,
        geometry=_geometry_of(db, site.id),
    )


@router.get("/sites/{site_id}/analytics", response_model=SiteAnalytics)
def site_analytics(site_id: int, db: DbSession, user: CurrentUser) -> SiteAnalytics:
    site = _owned_site(db, site_id, user.id)
    project = db.get(Project, site.project_id)

    rows = db.scalars(
        select(SiteMetric)
        .where(SiteMetric.site_id == site.id)
        .order_by(SiteMetric.metric_type, SiteMetric.date)
    ).all()

    grouped: dict[str, list[SiteMetric]] = {}
    for row in rows:
        grouped.setdefault(row.metric_type, []).append(row)

    kpis = [
        Kpi(
            key="area_ha",
            label="Site Area",
            value=round(site.area_ha, 2),
            unit="ha",
            source="PostGIS",
            is_modeled=False,
        )
    ]
    for key, (label, unit, source, modeled) in KPI_REGISTRY.items():
        entries = grouped.get(key)
        if entries:
            kpis.append(
                Kpi(
                    key=key,
                    label=label,
                    value=entries[-1].value,
                    unit=unit,
                    source=source,
                    is_modeled=modeled,
                )
            )

    series = [
        Series(
            metric_type=key,
            label=label,
            unit=unit,
            source=source,
            is_modeled=modeled,
            points=[SeriesPoint(date=m.date, value=m.value) for m in grouped[key]],
        )
        for key, (label, unit, source, modeled) in METRIC_REGISTRY.items()
        if grouped.get(key)
    ]

    taxa = sorted(
        (
            Taxon(name=key[len(TAXON_PREFIX) :], count=int(entries[-1].value))
            for key, entries in grouped.items()
            if key.startswith(TAXON_PREFIX)
        ),
        key=lambda t: t.count,
        reverse=True,
    )

    occurrence_entries = grouped.get("occurrence_total")
    occurrence_total = int(occurrence_entries[-1].value) if occurrence_entries else 0
    is_sparse = occurrence_total < SPARSE_THRESHOLD

    return SiteAnalytics(
        site_id=site.id,
        site_name=site.name,
        project_id=site.project_id,
        project_name=project.name if project else "",
        area_ha=round(site.area_ha, 2),
        ingest_status=site.ingest_status,
        kpis=kpis,
        series=series,
        taxa=taxa,
        data_quality=DataQuality(
            occurrence_total=occurrence_total,
            is_sparse=is_sparse,
            message=(
                f"Only {occurrence_total:,} occurrence records found for this polygon - "
                "this area is under-sampled in GBIF, so trends are indicative only."
                if is_sparse
                else None
            ),
        ),
    )
