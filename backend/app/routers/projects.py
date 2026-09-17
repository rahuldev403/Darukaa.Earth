from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.models import Project, Site
from app.schemas import ProjectCreate, ProjectDetail, ProjectOut, SiteSummary
from app.security import CurrentUser, DbSession

router = APIRouter(prefix="/projects", tags=["projects"])


def _aggregate_statement(user_id: int):
    return (
        select(
            Project,
            func.count(Site.id).label("site_count"),
            func.coalesce(func.sum(Site.area_ha), 0.0).label("total_area_ha"),
        )
        .outerjoin(Site, Site.project_id == Project.id)
        .where(Project.owner_id == user_id)
        .group_by(Project.id)
        .order_by(Project.created_at.desc())
    )


def _to_out(project: Project, site_count: int, total_area_ha: float) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        site_count=site_count,
        total_area_ha=round(float(total_area_ha or 0.0), 2),
    )


@router.get("", response_model=list[ProjectOut])
def list_projects(db: DbSession, user: CurrentUser) -> list[ProjectOut]:
    rows = db.execute(_aggregate_statement(user.id)).all()
    return [_to_out(project, count, area) for project, count, area in rows]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: DbSession, user: CurrentUser) -> ProjectOut:
    project = Project(
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        owner_id=user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return _to_out(project, 0, 0.0)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: DbSession, user: CurrentUser) -> None:
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    db.delete(project)
    db.commit()


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: DbSession, user: CurrentUser) -> ProjectDetail:
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    sites = db.scalars(
        select(Site).where(Site.project_id == project.id).order_by(Site.created_at.desc())
    ).all()

    return ProjectDetail(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        site_count=len(sites),
        total_area_ha=round(sum(site.area_ha for site in sites), 2),
        sites=[
            SiteSummary(
                id=site.id,
                name=site.name,
                area_ha=round(site.area_ha, 2),
                ingest_status=site.ingest_status,
            )
            for site in sites
        ],
    )
