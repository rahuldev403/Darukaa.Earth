from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class PolygonGeometry(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[tuple[float, float]]]

    @field_validator("coordinates")
    @classmethod
    def validate_rings(
        cls, value: list[list[tuple[float, float]]]
    ) -> list[list[tuple[float, float]]]:
        if not value:
            raise ValueError("Polygon must have at least one ring")

        for ring in value:
            if len(ring) < 4:
                raise ValueError("Each ring needs at least 4 positions")
            if ring[0] != ring[-1]:
                raise ValueError("Each ring must be closed (first position equals last)")
            for lon, lat in ring:
                if not -180 <= lon <= 180:
                    raise ValueError(f"Longitude {lon} out of range")
                if not -90 <= lat <= 90:
                    raise ValueError(f"Latitude {lat} out of range")
        return value


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserOut


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime
    site_count: int = 0
    total_area_ha: float = 0.0


class SiteSummary(BaseModel):
    id: int
    name: str
    area_ha: float
    ingest_status: str


class ProjectDetail(ProjectOut):
    sites: list[SiteSummary] = []


class SiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    geometry: PolygonGeometry


class SiteOut(BaseModel):
    id: int
    name: str
    project_id: int
    project_name: str | None = None
    area_ha: float
    ingest_status: str
    created_at: datetime
    geometry: dict[str, Any]


class Feature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: int
    geometry: dict[str, Any]
    properties: dict[str, Any]


class FeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[Feature] = []


class Kpi(BaseModel):
    key: str
    label: str
    value: float
    unit: str
    source: str
    is_modeled: bool = False


class SeriesPoint(BaseModel):
    date: date
    value: float


class Series(BaseModel):
    metric_type: str
    label: str
    unit: str
    source: str
    is_modeled: bool = False
    points: list[SeriesPoint] = []


class Taxon(BaseModel):
    name: str
    count: int


class DataQuality(BaseModel):
    occurrence_total: int = 0
    is_sparse: bool = False
    message: str | None = None


class SiteAnalytics(BaseModel):
    site_id: int
    site_name: str
    project_id: int
    project_name: str
    area_ha: float
    ingest_status: str
    kpis: list[Kpi] = []
    series: list[Series] = []
    taxa: list[Taxon] = []
    data_quality: DataQuality
