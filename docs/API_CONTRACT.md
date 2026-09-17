# API Contract (FROZEN — hour 0:45)

Both halves of the build code against this document. The frontend is written before the backend
exists, so **any change here must be agreed by both sides** — silent drift is the main risk of a
parallel build.

- Base URL: `${VITE_API_URL}` → all routes prefixed `/api`
- All request and response bodies are **JSON** (including login — *not* form-encoded)
- Authenticated routes require `Authorization: Bearer <access_token>`
- Errors always: `{ "detail": "<human readable message>" }`
- Timestamps: ISO-8601 UTC strings. IDs: integers.

---

## Auth

### `POST /api/auth/register`
```jsonc
// request
{ "email": "demo@darukaa.earth", "password": "demo12345" }
// 201
{ "access_token": "eyJ...", "token_type": "bearer",
  "user": { "id": 1, "email": "demo@darukaa.earth" } }
// 409 -> { "detail": "Email already registered" }
// 422 -> validation error (password min length 8)
```
Registration returns a token directly, so the user lands logged-in instead of being bounced to a
login form.

### `POST /api/auth/login`
```jsonc
{ "email": "demo@darukaa.earth", "password": "demo12345" }
// 200 -> same shape as register
// 401 -> { "detail": "Invalid credentials" }
```
> Same 401 message for unknown email and wrong password — never reveal which emails exist.

### `GET /api/auth/me`  *(auth)*
```jsonc
// 200
{ "id": 1, "email": "demo@darukaa.earth", "created_at": "2026-09-17T10:00:00Z" }
// 401 -> { "detail": "Not authenticated" }
```
Used on app boot to validate a stored token before trusting it.

---

## Projects

### `GET /api/projects`  *(auth)* — only the caller's own projects
```jsonc
[ { "id": 1, "name": "Western Ghats Restoration",
    "description": "Native shola reforestation",
    "created_at": "2026-09-17T10:00:00Z",
    "site_count": 3, "total_area_ha": 412.7 } ]
```

### `POST /api/projects`  *(auth)*
```jsonc
{ "name": "Western Ghats Restoration", "description": "Native shola reforestation" }
// 201 -> project object, site_count 0, total_area_ha 0
```

### `GET /api/projects/{id}`  *(auth)*
```jsonc
{ "id": 1, "name": "...", "description": "...", "created_at": "...",
  "site_count": 3, "total_area_ha": 412.7,
  "sites": [ { "id": 7, "name": "Block A", "area_ha": 120.4,
               "ingest_status": "complete" } ] }
// 404 -> { "detail": "Project not found" }   (also when it belongs to another user)
```
> A project owned by someone else returns **404, not 403** — don't leak that the ID exists.

---

## Sites

### `GET /api/sites`  *(auth)* — every site the user owns, as **GeoJSON**
Drives the main map. Returning a real `FeatureCollection` means it goes straight into a Mapbox
source with zero transformation on the client.
```jsonc
{ "type": "FeatureCollection",
  "features": [
    { "type": "Feature",
      "id": 7,
      "geometry": { "type": "Polygon", "coordinates": [[[77.5,12.9],[77.6,12.9],[77.6,13.0],[77.5,13.0],[77.5,12.9]]] },
      "properties": { "id": 7, "name": "Block A", "project_id": 1,
                      "project_name": "Western Ghats Restoration",
                      "area_ha": 120.4, "ingest_status": "complete" } } ] }
```

### `POST /api/projects/{id}/sites`  *(auth)* — create by drawing a polygon
```jsonc
// request — geometry is exactly what mapbox-gl-draw emits
{ "name": "Block A",
  "geometry": { "type": "Polygon", "coordinates": [[[77.5,12.9],[77.6,12.9],[77.6,13.0],[77.5,13.0],[77.5,12.9]]] } }
// 201
{ "id": 7, "name": "Block A", "project_id": 1, "area_ha": 120.4,
  "ingest_status": "complete", "created_at": "...", "geometry": { ... } }
// 422 -> { "detail": "Geometry must be a closed GeoJSON Polygon in EPSG:4326" }
```
**This request is slow on purpose (~3–8s)** — GBIF and NASA POWER are called and persisted before
it returns. The frontend shows a progress state. Validate: type is `Polygon`, ring is closed,
lon ∈ [-180,180], lat ∈ [-90,90], ≥ 4 coordinate pairs.

### `GET /api/sites/{id}`  *(auth)*
```jsonc
{ "id": 7, "name": "Block A", "project_id": 1, "project_name": "...",
  "area_ha": 120.4, "ingest_status": "complete", "created_at": "...",
  "geometry": { ... } }
```

### `GET /api/sites/{id}/analytics`  *(auth)* — the payload behind the whole detail page
```jsonc
{
  "site_id": 7,
  "area_ha": 120.4,
  "ingest_status": "complete",

  "kpis": [
    { "key": "area_ha",                 "label": "Site Area",
      "value": 120.4,  "unit": "ha",      "source": "PostGIS",     "is_modeled": false },
    { "key": "species_richness",        "label": "Species Recorded",
      "value": 847,    "unit": "species", "source": "GBIF",        "is_modeled": false },
    { "key": "occurrence_total",        "label": "Occurrence Records",
      "value": 322591, "unit": "records", "source": "GBIF",        "is_modeled": false },
    { "key": "carbon_baseline_tco2e",   "label": "Carbon Stock (baseline)",
      "value": 45230.0,"unit": "tCO2e",   "source": "IPCC Tier 1", "is_modeled": true }
  ],

  "series": [
    { "metric_type": "species_occurrences", "label": "Species Occurrences",
      "unit": "records", "source": "GBIF", "is_modeled": false,
      "points": [ { "date": "2020-01-01", "value": 39602 },
                  { "date": "2021-01-01", "value": 41667 } ] },
    { "metric_type": "temperature_c", "label": "Mean Temperature",
      "unit": "°C", "source": "NASA POWER", "is_modeled": false,
      "points": [ { "date": "2022-01-01", "value": 20.86 } ] },
    { "metric_type": "precipitation_mm", "label": "Precipitation",
      "unit": "mm/day", "source": "NASA POWER", "is_modeled": false,
      "points": [ { "date": "2022-01-01", "value": 0.07 } ] },
    { "metric_type": "sequestration_projection_tco2e", "label": "Projected Sequestration",
      "unit": "tCO2e", "source": "IPCC Tier 1", "is_modeled": true,
      "points": [ { "date": "2026-01-01", "value": 512.3 } ] }
  ],

  "taxa": [ { "name": "Aves",     "count": 311742 },
            { "name": "Insecta",  "count": 6621 },
            { "name": "Magnoliopsida", "count": 2431 } ],

  "data_quality": {
    "occurrence_total": 322591,
    "is_sparse": false,
    "message": null
  }
}
```

### Contract rules the frontend depends on

1. **`kpis` and `series` are rendered generically.** The frontend loops over whatever arrives — it
   never hardcodes metric names. Add a metric on the backend and it appears in the UI with no
   frontend change.
2. **`source` and `is_modeled` are required on every KPI and series.** They render as a provenance
   badge; `is_modeled: true` also renders the line dashed. This is the honesty feature — a modeled
   projection must never look like a measurement.
3. **`series` may be an empty array** and `taxa` may be empty. The page must still render.
4. **`data_quality.is_sparse`** — set `true` when `occurrence_total < 100`. A real rural test
   polygon returned only **3** records, so this is a common path, not an edge case. When true, put
   a human sentence in `message`, e.g. `"Only 3 occurrence records found — this area is
   under-sampled in GBIF."`
5. **`ingest_status`** ∈ `"pending" | "complete" | "partial" | "failed"`. `"partial"` means one
   upstream source failed. The site is always created regardless — external APIs must never block
   site creation.

---

## Status codes used

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created (register, project, site) |
| 401 | Missing/invalid/expired token, or bad credentials |
| 404 | Not found **or** owned by another user |
| 409 | Email already registered |
| 422 | Validation failed (FastAPI default shape) |
| 502 | Reserved: total upstream failure (avoid — prefer 201 + `ingest_status: "failed"`) |
