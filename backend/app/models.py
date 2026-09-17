from __future__ import annotations

import datetime

from geoalchemy2 import Geometry
from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    projects: Mapped[list[Project]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped[User] = relationship(back_populates="projects")
    sites: Mapped[list[Site]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    geom: Mapped[str] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True)
    )
    area_ha: Mapped[float] = mapped_column(default=0.0)
    ingest_status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    project: Mapped[Project] = relationship(back_populates="sites")
    metrics: Mapped[list[SiteMetric]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )


class SiteMetric(Base):
    __tablename__ = "site_metrics"
    __table_args__ = (Index("ix_site_metrics_site_metric", "site_id", "metric_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    date: Mapped[datetime.date] = mapped_column(Date)
    metric_type: Mapped[str] = mapped_column(String(50))
    value: Mapped[float] = mapped_column()
    unit: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(50))
    is_modeled: Mapped[bool] = mapped_column(default=False)

    site: Mapped[Site] = relationship(back_populates="metrics")
