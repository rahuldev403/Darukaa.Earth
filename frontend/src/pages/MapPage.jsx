import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { apiError } from '../api/client.js';
import { createSite, deleteSite, listProjects, listSitesGeoJson } from '../api/resources.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import MapSearch from '../components/MapSearch.jsx';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] };

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function boundsOf(collection) {
  const bounds = new mapboxgl.LngLatBounds();
  let found = false;

  for (const feature of collection.features ?? []) {
    for (const ring of feature.geometry?.coordinates ?? []) {
      for (const position of ring) {
        bounds.extend(position);
        found = true;
      }
    }
  }
  return found ? bounds : null;
}

export default function MapPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const hasFitRef = useRef(false);
  const searchMarkerRef = useRef(null);

  const [sites, setSites] = useState(EMPTY_COLLECTION);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);

  const [mapError, setMapError] = useState(null);
  const [projection, setProjection] = useState('globe');
  const [autoFlattened, setAutoFlattened] = useState(false);
  const projectionRef = useRef('globe');
  const [pending, setPending] = useState(null);
  const [siteName, setSiteName] = useState('');
  const [targetProject, setTargetProject] = useState(projectId ?? '');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [hoveredSiteId, setHoveredSiteId] = useState(null);
  const [focusedSiteId, setFocusedSiteId] = useState(null);
  const highlightedSiteId = hoveredSiteId ?? focusedSiteId;

  const loadData = useCallback(async () => {
    try {
      const [collection, projectList] = await Promise.all([
        listSitesGeoJson(projectId),
        listProjects(),
      ]);
      setSites(collection ?? EMPTY_COLLECTION);
      setProjects(projectList ?? []);
      setTargetProject((current) => current || projectId || String(projectList?.[0]?.id ?? ''));
    } catch (err) {
      setError(apiError(err, 'Could not load map data.'));
    }
  }, [projectId]);

  useEffect(() => {
    hasFitRef.current = false;
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current || !mapContainer.current) return undefined;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const container = mapContainer.current;

    let map;
    try {
      map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        projection: 'globe',
        center: [78.9629, 20.5937],
        zoom: 3.5,
      });
    } catch (err) {
      setMapError(`Map failed to initialise: ${err?.message ?? err}`);
      return undefined;
    }
    mapRef.current = map;

    map.on('error', (event) => {
      const message = event?.error?.message ?? 'Unknown Mapbox error';
      setMapError(message);
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    try {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });
      drawRef.current = draw;
      map.addControl(draw, 'top-right');
    } catch (err) {
      setMapError(`Drawing tool failed to load: ${err?.message ?? err}`);
    }

    map.on('load', () => {
      if (map.getProjection()?.name !== projectionRef.current) {
        map.setProjection(projectionRef.current);
      }

      map.addSource('sites', { type: 'geojson', data: EMPTY_COLLECTION });

      map.addLayer({
        id: 'sites-fill',
        type: 'fill',
        source: 'sites',
        paint: { 'fill-color': '#2f8f5b', 'fill-opacity': 0.25 },
      });

      map.addLayer({
        id: 'sites-outline',
        type: 'line',
        source: 'sites',
        paint: { 'line-color': '#d3ecdd', 'line-width': 2 },
      });

      map.addLayer({
        id: 'sites-highlight-fill',
        type: 'fill',
        source: 'sites',
        filter: ['==', ['get', 'id'], -1],
        paint: { 'fill-color': '#4da878', 'fill-opacity': 0.5 },
      });

      map.addLayer({
        id: 'sites-highlight-line',
        type: 'line',
        source: 'sites',
        filter: ['==', ['get', 'id'], -1],
        paint: { 'line-color': '#ffffff', 'line-width': 3.5 },
      });

      map.addLayer({
        id: 'sites-label',
        type: 'symbol',
        source: 'sites',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, 0.4],
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#1b5435',
          'text-halo-width': 1.4,
        },
      });
    });

    map.on('draw.modechange', (event) => {
      if (event?.mode?.startsWith('draw_') && projectionRef.current === 'globe') {
        projectionRef.current = 'mercator';
        setProjection('mercator');
        setAutoFlattened(true);
      }
    });

    map.on('draw.create', (event) => {
      const feature = event.features?.[0];
      if (feature) setPending(feature.geometry);
    });

    map.on('click', 'sites-fill', (event) => {
      const id = event.features?.[0]?.properties?.id;
      if (id) navigate(`/sites/${id}`);
    });

    map.on('mousemove', 'sites-fill', (event) => {
      map.getCanvas().style.cursor = 'pointer';
      const id = event.features?.[0]?.properties?.id;
      if (id != null) setHoveredSiteId(id);
    });
    map.on('mouseleave', 'sites-fill', () => {
      map.getCanvas().style.cursor = '';
      setHoveredSiteId(null);
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [navigate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const source = map.getSource('sites');
      if (!source) return;

      source.setData(sites);

      if (!hasFitRef.current && sites.features?.length) {
        const bounds = boundsOf(sites);
        if (bounds) {
          map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 700 });
          hasFitRef.current = true;
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
  }, [sites]);

  useEffect(() => {
    projectionRef.current = projection;
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (map.getProjection()?.name !== projection) {
        map.setProjection(projection);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
  }, [projection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const filter = ['==', ['get', 'id'], highlightedSiteId ?? -1];
    const apply = () => {
      for (const layerId of ['sites-highlight-fill', 'sites-highlight-line']) {
        if (map.getLayer(layerId)) map.setFilter(layerId, filter);
      }
    };

    if (map.getLayer('sites-highlight-line')) apply();
    else map.once('idle', apply);
  }, [highlightedSiteId]);

  const getSearchBias = useCallback(() => {
    const map = mapRef.current;
    if (!map) return null;
    const center = map.getCenter();
    return { lat: center.lat, lon: center.lng, zoom: map.getZoom() };
  }, []);

  const placeSearchMarker = (lngLat) => {
    const map = mapRef.current;
    searchMarkerRef.current?.remove();
    searchMarkerRef.current =
      map && lngLat ? new mapboxgl.Marker({ color: '#237249' }).setLngLat(lngLat).addTo(map) : null;
  };

  const handleSelectPlace = (place) => {
    const map = mapRef.current;
    if (!map) return;

    placeSearchMarker(place.center);
    setFocusedSiteId(null);
    if (place.bbox) {
      map.fitBounds(place.bbox, { padding: 80, maxZoom: 15, duration: 1400 });
    } else {
      map.flyTo({ center: place.center, zoom: 13, duration: 1400 });
    }
  };

  const handleSelectSite = (feature) => {
    const map = mapRef.current;
    if (!map) return;

    placeSearchMarker(null);
    setFocusedSiteId(feature.properties.id);
    const bounds = boundsOf({ features: [feature] });
    if (bounds) map.fitBounds(bounds, { padding: 120, maxZoom: 15, duration: 1400 });
  };

  const confirmDeleteSite = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSite(pendingDelete.id);
      setPendingDelete(null);
      await loadData();
    } catch (err) {
      setDeleteError(apiError(err, 'Could not delete the site.'));
    } finally {
      setDeleting(false);
    }
  };

  const cancelPending = () => {
    drawRef.current?.deleteAll();
    setPending(null);
    setSiteName('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!pending || !targetProject || !siteName.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await createSite(targetProject, { name: siteName.trim(), geometry: pending });
      cancelPending();
      await loadData();
    } catch (err) {
      setError(apiError(err, 'Could not save the site.'));
    } finally {
      setSaving(false);
    }
  };

  const activeProject = projectId ? projects.find((p) => String(p.id) === String(projectId)) : null;
  const siteCount = sites.features?.length ?? 0;
  const totalArea = (sites.features ?? []).reduce(
    (sum, feature) => sum + (feature.properties?.area_ha ?? 0),
    0
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="grid h-full place-items-center px-5">
        <div className="card max-w-md p-6 text-center">
          <h2 className="font-semibold">Mapbox token missing</h2>
          <p className="mt-2 text-sm text-muted">
            Add <code className="font-mono text-xs">VITE_MAPBOX_TOKEN</code> to
            <code className="font-mono text-xs"> frontend/.env.local</code> and restart the dev
            server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col gap-2 p-4 pr-16 lg:flex-row lg:items-start">
        <div className="pointer-events-auto w-full lg:w-80 lg:shrink-0">
          <MapSearch
            sites={sites}
            getBias={getSearchBias}
            onSelectPlace={handleSelectPlace}
            onSelectSite={handleSelectSite}
          />
        </div>

        <div className="pointer-events-auto flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface/90 px-4 py-2.5 shadow-lift backdrop-blur-md lg:mx-auto lg:max-w-xl">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
            <span className="truncate">{activeProject ? activeProject.name : 'All sites'}</span>
            <span className="shrink-0 text-muted">
              · {siteCount} site{siteCount === 1 ? '' : 's'}
            </span>
          </span>

          {activeProject && (
            <Link to="/map" className="shrink-0 text-xs text-forest-700 hover:underline">
              View all
            </Link>
          )}
          <span className="hidden text-xs text-muted 2xl:inline">
            Click the polygon tool, trace a boundary, then double-click to finish.
          </span>

          <div className="ml-auto flex shrink-0 items-center rounded-lg border border-line bg-canvas p-0.5">
            {[
              ['globe', 'Globe'],
              ['mercator', 'Map'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setProjection(value);
                  setAutoFlattened(false);
                }}
                aria-pressed={projection === value}
                className={`rounded-[7px] px-2.5 py-1 text-xs font-medium transition-colors ${
                  projection === value
                    ? 'bg-surface text-ink shadow-soft'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {totalArea > 0 && (
            <span className="hidden shrink-0 text-xs tabular-nums text-muted xl:inline">
              {numberFormat.format(totalArea)} ha
            </span>
          )}
        </div>
      </div>

      {autoFlattened && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-4">
          <p className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs text-muted shadow-lift backdrop-blur-md">
            Switched to flat view — polygons can&apos;t be drawn on the globe.
            <button
              type="button"
              onClick={() => setAutoFlattened(false)}
              className="font-medium text-forest-700 hover:underline"
            >
              Got it
            </button>
          </p>
        </div>
      )}

      {mapError && (
        <div className="absolute left-1/2 top-24 z-30 w-[min(32rem,90vw)] -translate-x-1/2">
          <div className="card border-danger-500/40 p-4 shadow-float">
            <p className="text-sm font-semibold text-danger-500">Map error</p>
            <p className="mt-1 font-mono text-xs break-words text-muted">{mapError}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-0 bottom-6 z-10 px-4">
          <p
            role="alert"
            className="mx-auto max-w-lg rounded-lg border border-danger-500/30 bg-surface px-4 py-2.5 text-center text-sm text-danger-500 shadow-lift"
          >
            {error}
          </p>
        </div>
      )}

      {siteCount > 0 && !pending && (
        <div className="absolute bottom-6 left-4 z-10 w-72">
          <div className="card max-h-72 overflow-auto p-2 shadow-lift">
            <p className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-faint">
              Sites · hover to highlight
            </p>
            <ul onMouseLeave={() => setHoveredSiteId(null)}>
              {sites.features.map((feature) => {
                const { id, name, area_ha: areaHa } = feature.properties;
                const focused = id === focusedSiteId;
                const highlighted = id === highlightedSiteId;

                return (
                  <li
                    key={id}
                    onMouseEnter={() => setHoveredSiteId(id)}
                    onFocus={() => setHoveredSiteId(id)}
                    onBlur={() => setHoveredSiteId(null)}
                    className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${
                      highlighted ? 'bg-forest-50' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSite(feature)}
                      title={`Show ${name} on the map`}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span
                        className={`block truncate text-sm font-medium ${
                          focused ? 'text-forest-700' : ''
                        }`}
                      >
                        {name}
                      </span>
                      <span className="block text-[11px] tabular-nums text-muted">
                        {numberFormat.format(areaHa ?? 0)} ha
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleSelectSite(feature)}
                        className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-body transition-colors hover:border-forest-400 hover:text-forest-700"
                      >
                        Map
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/sites/${id}`)}
                        className="rounded-md bg-forest-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-forest-700"
                      >
                        Analytics
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${name}`}
                        title="Delete site"
                        onClick={() => setPendingDelete({ id, name })}
                        className="rounded-md p-1.5 text-faint transition-colors hover:bg-danger-500/10 hover:text-danger-500"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M3 4.5h10M6.5 4.5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        body="This permanently removes the site and every metric collected for it. This cannot be undone."
        confirmLabel="Delete site"
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDeleteSite}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />

      {pending && (
        <div className="absolute right-4 top-20 z-20 w-80 animate-fade-up">
          <form onSubmit={handleSave} className="card space-y-4 p-5 shadow-float">
            <div>
              <h3 className="font-semibold">Save this site</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                We&apos;ll compute the true area and pull biodiversity and climate records for this
                exact boundary.
              </p>
            </div>

            <div>
              <label htmlFor="site-name" className="label">
                Site name
              </label>
              <input
                id="site-name"
                required
                autoFocus
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="input"
                placeholder="Block A"
              />
            </div>

            <div>
              <label htmlFor="site-project" className="label">
                Project
              </label>
              <select
                id="site-project"
                required
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                className="input"
              >
                <option value="" disabled>
                  Select a project
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {projects.length === 0 && (
                <p className="mt-1.5 text-xs text-danger-500">
                  Create a project first, then draw its sites.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !siteName.trim() || !targetProject}
                className="btn btn-primary flex-1"
              >
                {saving && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {saving ? 'Analysing…' : 'Save site'}
              </button>
              <button
                type="button"
                onClick={cancelPending}
                disabled={saving}
                className="btn btn-secondary"
              >
                Discard
              </button>
            </div>

            {saving && (
              <p className="text-xs leading-relaxed text-muted">
                Querying GBIF and NASA POWER for this polygon — this takes a few seconds.
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
