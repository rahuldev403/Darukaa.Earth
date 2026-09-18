# Darukaa.Earth

A full-stack geospatial platform for managing carbon and biodiversity projects. Draw a project
site on a map, and the platform measures its area, pulls real species-occurrence and climate data
for that exact polygon, and presents the results as time-series analytics with explicit data
provenance.

|                |                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Live demo**  | https://darukaa-dashborad.vercel.app                                                          |
| **API**        | https://darukaa-api-uszh.onrender.com · [`/docs`](https://darukaa-api-uszh.onrender.com/docs) |
| **Demo login** | `level432520537352822@gmail.com` / `dfd33343d`                                                |

> The API is on Render's free tier and sleeps when idle. The first request can take ~50 seconds
> while the container wakes. Loading `/health` once before demoing avoids this.

![Darukaa.Earth landing page](docs/screenshots/landing.png)

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Data sources](#data-sources)
- [Database schema](#database-schema)
- [API](#api)
- [Running locally](#running-locally)
- [CI/CD pipeline](#cicd-pipeline)
- [Trade-offs and limitations](#trade-offs-and-limitations)

---

## What it does

1. **Register / sign in** — JWT-based authentication.
2. **Create a project** — a carbon or biodiversity programme.
3. **Draw a site** — draw a polygon directly on the map. The backend stores the true geometry in
   PostGIS, computes its geodesic area, and ingests external data for that exact shape.
4. **View analytics** — KPIs and time-series charts for each site, every value labelled with its
   source and whether it is measured or modelled.

---

## Architecture

```mermaid
flowchart LR
    U[Browser] --> V[Vercel<br/>React + Vite SPA]
    V -- "JWT / JSON" --> R[Render<br/>FastAPI]
    R --> N[(Neon<br/>PostgreSQL + PostGIS)]
    R -. "ingest-time only" .-> G[GBIF API]
    R -. "ingest-time only" .-> P[NASA POWER API]
```

**Three tiers.** A React SPA on Vercel, a FastAPI service on Render, and Neon Postgres with the
PostGIS extension. All analytics data reaches the frontend through our own API — the browser never
calls GBIF or NASA POWER. The one direct external call is map place search (Photon), an interactive
lookup whose results are never stored.

### The central design decision: ingest once, serve from the database

External APIs are called **once, when a site is created**, and the results are persisted to
`site_metrics`. Every subsequent read is a local Postgres query.

```
POST /api/projects/{id}/sites
  ├── store polygon as PostGIS geometry(POLYGON, 4326)
  ├── compute area with ST_Area(geom::geography)
  ├── asyncio.gather(GBIF, NASA POWER)     ~5s, concurrent
  ├── compute IPCC Tier 1 carbon estimate
  └── persist all metrics, set ingest_status
                                            → subsequent reads: pure DB, no network
```

Why this matters:

- **Predictable latency.** Site creation is knowingly slow (~8s, with a progress state in the UI).
  Every page load afterwards is fast.
- **Resilience.** External APIs are an _ingestion_ dependency, never a _request-path_ dependency.
  If GBIF is down, the site is still created and `ingest_status` records the degradation — the
  app never fails because a third party is unavailable.
- **Partial failure is a first-class state.** `asyncio.gather(..., return_exceptions=True)` means
  one failing provider yields `ingest_status: "partial"`, not a 500.

### Data provenance as a product feature

Every row in `site_metrics` carries a `source` and an `is_modeled` flag, which flow through to the
UI as a badge on each chart, with modelled series drawn as dashed lines.

This is deliberate. In carbon accounting, _how you know something_ is as important as the number.
A GBIF species observation is a **measurement**; an IPCC Tier 1 carbon figure is a **model
output**. Rendering them identically would misrepresent the second. The schema makes conflating
them impossible.

---

## Data sources

All analytics come from real, public, keyless APIs. Nothing is randomly generated.

| Source                                                       | Provides                                                                                                 | Nature       | Verified latency |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------ | ---------------- |
| [GBIF Occurrence API](https://techdocs.gbif.org/en/openapi/) | Species occurrence records **inside the drawn polygon** (WKT query), faceted by year and taxonomic class | observed     | ~1s              |
| [NASA POWER](https://power.larc.nasa.gov/docs/services/api/) | Monthly mean temperature and precipitation, 10 years                                                     | measured     | ~3s              |
| PostGIS `ST_Area(geom::geography)`                           | True geodesic site area in hectares                                                                      | computed     | instant          |
| IPCC 2006 Guidelines Vol.4 Ch.4                              | Tier 1 biomass carbon stock and growth defaults                                                          | **modelled** | instant          |

**Verification:** a 0.1° × 0.1° polygon over Bangalore returns 319,025 occurrence records
(310,909 Aves, 4,538 Insecta) and a computed area of 12,004 ha — against a hand calculation of
11.1 km × 10.85 km ≈ 12,040 ha.

### Sources evaluated and rejected

- **ISRIC SoilGrids** (soil organic carbon) — genuinely useful data, but the query endpoint timed
  out at 60s in testing and then failed to connect entirely. Unsuitable for a request path.
- **Sentinel-2 NDVI via STAC** — real satellite imagery, but raster processing (`rasterio` /
  `stackstac`) means heavy dependencies and multi-hundred-megabyte downloads that do not fit
  Render's free 512 MB tier.

### Sparse data is handled explicitly

Biodiversity records are unevenly distributed. A rural test polygon returned **3 records**, versus
319,025 for an urban one. When `occurrence_total < 100` the API sets `data_quality.is_sparse` and
returns a human-readable message, which the UI surfaces as a warning rather than rendering a
misleadingly empty chart.

---

## Database schema

```
users                                  projects
──────────────────────────             ──────────────────────────
id              serial PK              id              serial PK
email           varchar(255) UNIQUE    name            varchar(200)
hashed_password varchar(255)           description     text NULL
created_at      timestamptz            owner_id        FK users(id) CASCADE
                                       created_at      timestamptz

sites                                  site_metrics
──────────────────────────             ──────────────────────────
id              serial PK              id              serial PK
name            varchar(200)           site_id         FK sites(id) CASCADE
project_id      FK projects(id)        date            date
geom            geometry(POLYGON,4326) metric_type     varchar(50)
area_ha         double precision       value           double precision
ingest_status   varchar(20)            unit            varchar(20)
created_at      timestamptz            source          varchar(50)
                                       is_modeled      boolean
```

**Indexes**

| Index                         | Type                            | Why                                                                                                                                                     |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idx_sites_geom`              | **GiST**                        | B-tree cannot order 2D shapes. GiST indexes bounding boxes, making spatial queries viable.                                                              |
| `ix_site_metrics_site_metric` | B-tree `(site_id, metric_type)` | The analytics query filters on exactly this pair. A separate `site_id` index would be redundant — a composite index already serves its leftmost prefix. |
| `ix_users_email`              | B-tree UNIQUE                   | Enforces uniqueness and serves every login lookup.                                                                                                      |
| `ix_projects_owner_id`        | B-tree                          | Every "list my projects" query filters on it.                                                                                                           |

**Notes on modelling choices**

- `srid=4326` (WGS84) throughout — the coordinate system GeoJSON and Mapbox both use, so no
  reprojection is needed anywhere in the stack.
- The **full polygon** is stored, not a bounding box. This is what allows a true geodesic area and
  an exact-shape GBIF query.
- `area_ha` is **denormalised**. It is computed once at ingest because the polygon never changes,
  and read on every page view. The read/write ratio justifies it.
- `site_metrics` is a narrow, tall table rather than a column per metric, so adding a new metric
  needs no migration — and the analytics endpoint renders whatever rows exist.

---

## API

Base path `/api`. Full interactive documentation at [`/docs`](https://darukaa-api-uszh.onrender.com/docs).

| Method | Path                    | Purpose                                        |
| ------ | ----------------------- | ---------------------------------------------- |
| `POST` | `/auth/register`        | Create account, returns JWT                    |
| `POST` | `/auth/login`           | Exchange credentials for JWT                   |
| `GET`  | `/auth/me`              | Validate token, return current user            |
| `GET`  | `/projects`             | List projects with site counts and total area  |
| `POST` | `/projects`             | Create a project                               |
| `GET`  | `/projects/{id}`        | Project detail with its sites                  |
| `GET`  | `/sites`                | **All sites as a GeoJSON `FeatureCollection`** |
| `POST` | `/projects/{id}/sites`  | Create a site from a polygon and ingest data   |
| `GET`  | `/sites/{id}`           | Site detail                                    |
| `GET`  | `/sites/{id}/analytics` | KPIs, time series, taxa, data quality          |

`GET /sites` returns a real GeoJSON `FeatureCollection`, so it feeds a Mapbox source with zero
client-side transformation.

**Security details**

- Passwords hashed with bcrypt; `UserOut` has no password field, so a hash cannot be serialised.
- Unknown email and wrong password return an identical 401 — no user enumeration.
- A resource owned by another user returns **404, not 403**, so IDs cannot be probed.
- Ownership is enforced **in the SQL WHERE clause**, not as a check after fetching.

---

## Running locally

**Prerequisites:** Python 3.11+, Node 20+, a Postgres database with PostGIS, a Mapbox token.

### 1. Database

Any PostGIS-enabled Postgres works. On Neon, in the SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Version();
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

cp .env.example .env             # then fill it in
uvicorn app.main:app --reload
```

`backend/.env`:

```
DATABASE_URL=postgresql+psycopg://user:pass@host/db?sslmode=require
JWT_SECRET=<python -c "import secrets; print(secrets.token_urlsafe(32))">
CORS_ORIGINS=http://localhost:5173
```

> The `postgresql+psycopg://` prefix is required. Providers hand you `postgresql://`, which makes
> SQLAlchemy look for the (uninstalled) `psycopg2` driver.

Tables are created automatically at startup. API at http://localhost:8000, docs at `/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.local`:

```
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_TOKEN=pk.your_token
```

> `VITE_*` variables are inlined at **build** time. Changing one requires a rebuild, not a restart.

### 4. Quality tooling

```bash
npm install                      # repo root - installs husky hooks
cd backend && pytest -q          # 21 unit tests
ruff check . && ruff format --check .
cd frontend && npm run lint && npm run build
```

---

## CI/CD pipeline

### Pre-commit hooks (Husky + lint-staged)

`.husky/pre-commit` runs `npx lint-staged`, which applies fixers to **staged files only**:

| Pattern                              | Tools                             |
| ------------------------------------ | --------------------------------- |
| `frontend/**/*.{js,jsx,css,json,md}` | `prettier --write`                |
| `frontend/**/*.{js,jsx}`             | `oxlint --fix`                    |
| `backend/**/*.py`                    | `ruff check --fix`, `ruff format` |

Because this is a monorepo, `lint-staged.config.mjs` resolves each binary by explicit path —
`ruff` lives in `backend/.venv`, `oxlint` in `frontend/node_modules`, and lint-staged executes
from the repository root where neither is on `PATH`.

`.gitattributes` normalises line endings to LF. Without it, `core.autocrlf` on Windows causes
lint-staged's internal `git apply` to fail.

### GitHub Actions (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main`, as two parallel jobs:

**Backend** — `ruff check` (lint) → `ruff format --check` (formatting) → `pytest` (21 tests).
**Frontend** — `oxlint` → `prettier --check` → `vite build`.

Both jobs use dependency caching, and `concurrency` cancels superseded runs on the same branch.

The hooks and CI are deliberately **not** redundant: hooks give fast local feedback and can be
bypassed with `--no-verify`, so CI is the authoritative gate that cannot be skipped.

### Deployment

**Backend → Render**, configured as code in `render.yaml`:

- `rootDir: backend` so the monorepo's frontend is ignored
- `startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT` — binding `0.0.0.0` is
  required; the default `127.0.0.1` is unreachable from outside the container
- `healthCheckPath: /health`, which deliberately does **not** touch the database, so a transient
  database issue cannot cause Render to roll back a healthy deploy
- Secrets are marked `sync: false` and set in the dashboard, never committed

**Frontend → Vercel**, root directory `frontend`. `vercel.json` rewrites all paths to
`index.html`; without it, refreshing a client-side route such as `/sites/7` returns 404.

Both redeploy automatically on push to `main`.

---

## Trade-offs and limitations

These are conscious decisions made for a time-boxed build, not oversights.

**`create_all()` instead of Alembic migrations.** Tables are created from model metadata at
startup. This cannot evolve a schema — `create_all` only ever creates, never alters or drops, so
any column change needs manual SQL. Alembic is the production answer; it was not worth the setup
cost here. _Impact: schema changes are manual._

**The carbon model has no land-cover awareness.** It applies IPCC Tier 1 tropical-forest biomass
defaults to any polygon, so drawing over a city yields a forest-sized carbon figure. A Tier 2
approach would classify land cover first and select factors accordingly. This is the single
largest accuracy limitation, and it is why every carbon value is flagged `is_modeled: true`.
_Impact: carbon figures are order-of-magnitude indicative, not auditable._

**JWT in `localStorage`.** Readable by any JavaScript on the page, so it is XSS-exposed. An
`httpOnly` cookie is safer but requires CSRF protection and cross-site cookie configuration
between two different domains (Vercel and Render). _Impact: acceptable here with no third-party
scripts; would need revisiting before production._

**Synchronous SQLAlchemy inside async route handlers.** Database calls briefly block the event
loop. Queries are all indexed and sub-millisecond, so the practical impact is negligible at this
scale, but `asyncpg` with async sessions would be correct under load.

**Species richness is capped at 500.** GBIF facet results are limited, so richness above 500 is
reported as "500+" rather than an exact figure.

**No refresh tokens.** Access tokens last 24 hours, after which the user signs in again.

**Render free tier sleeps.** First request after idle takes ~50 seconds. The UI detects a slow
request and explains that the server is waking, rather than appearing broken.

**Place search uses Photon, a free OpenStreetMap geocoder.** Mapbox's geocoder was tested first and
performed poorly on rural India: "Agumbe" resolved to Spain, "Hebbal Lake" to New York, and
"Sajnekhali" returned nothing. Photon located four of five test places within a kilometre. It is a
community service with fair-use limits and no uptime guarantee, so the search box degrades to a
message if it fails, and production would self-host Photon or use a paid geocoder.

### With more time

Alembic migrations · land-cover classification for Tier 2 carbon factors · Redis caching of GBIF
responses · background ingestion via a task queue so site creation returns immediately ·
integration tests against a containerised PostGIS · refresh-token rotation.
