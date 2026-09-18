import { useEffect, useId, useMemo, useRef, useState } from 'react';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const PLACE_LIMIT = 6;
const SITE_LIMIT = 3;

function describePlace(properties) {
  const parts = [
    properties.city || properties.district || properties.county,
    properties.state,
    properties.country,
  ].filter((part) => part && part !== properties.name);
  return [...new Set(parts)].join(', ');
}

function toPlace(feature) {
  const properties = feature.properties ?? {};
  const [lon, lat] = feature.geometry.coordinates;
  const extent = properties.extent;

  return {
    kind: 'place',
    key: `place-${properties.osm_type}${properties.osm_id}`,
    label: properties.name || describePlace(properties),
    detail: describePlace(properties),
    tag: properties.osm_value?.replaceAll('_', ' '),
    center: [lon, lat],
    bbox: extent
      ? [
          [extent[0], extent[3]],
          [extent[2], extent[1]],
        ]
      : null,
  };
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ResultIcon({ kind }) {
  if (kind === 'site') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 2.5 13.5 6.5 11.5 13h-7l-2-6.5L8 2.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0C3.5 9.8 8 14 8 14Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

export default function MapSearch({ sites, getBias, onSelectPlace, onSelectSite }) {
  const listId = useId();
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const trimmed = query.trim();
  const searchable = trimmed.length >= MIN_QUERY_LENGTH;

  const siteMatches = useMemo(() => {
    if (!searchable) return [];
    const needle = trimmed.toLowerCase();
    return (sites?.features ?? [])
      .filter((feature) => feature.properties?.name?.toLowerCase().includes(needle))
      .slice(0, SITE_LIMIT)
      .map((feature) => ({
        kind: 'site',
        key: `site-${feature.properties.id}`,
        label: feature.properties.name,
        detail: feature.properties.project_name,
        feature,
      }));
  }, [sites, trimmed, searchable]);

  useEffect(() => {
    if (!searchable) {
      setPlaces([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ q: trimmed, limit: String(PLACE_LIMIT), lang: 'en' });
      const bias = getBias?.();
      if (bias) {
        params.set('lat', bias.lat.toFixed(4));
        params.set('lon', bias.lon.toFixed(4));
        if (Number.isFinite(bias.zoom)) params.set('zoom', String(Math.round(bias.zoom)));
      }

      try {
        const response = await fetch(`${PHOTON_URL}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setPlaces((data.features ?? []).map(toPlace));
        setActive(0);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setPlaces([]);
        setError('Place search is unavailable right now.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searchable, getBias]);

  const results = [...siteMatches, ...places];
  const showList = open && searchable;

  const choose = (item) => {
    if (!item) return;
    if (item.kind === 'site') onSelectSite?.(item.feature);
    else onSelectPlace?.(item);
    setQuery(item.label);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[active] ?? results[0]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const optionId = (index) => `${listId}-option-${index}`;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 text-muted shadow-lift backdrop-blur-md transition-colors focus-within:border-forest-400">
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? optionId(active) : undefined}
          aria-label="Search places or your sites"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search places or your sites"
          className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-faint"
        />
        {loading ? (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-forest-600" />
        ) : (
          query && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="shrink-0 rounded-md p-0.5 text-faint transition-colors hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="m4.5 4.5 7 7m0-7-7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )
        )}
      </div>

      {showList && (
        <div
          id={listId}
          role="listbox"
          onMouseDown={(event) => event.preventDefault()}
          className="card animate-fade-in absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-auto p-1.5 shadow-float"
        >
          {results.map((item, index) => {
            const firstOfGroup = index === 0 || results[index - 1].kind !== item.kind;
            return (
              <div key={item.key}>
                {firstOfGroup && (
                  <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                    {item.kind === 'site' ? 'Your sites' : 'Places'}
                  </p>
                )}
                <button
                  type="button"
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    index === active ? 'bg-forest-50 text-forest-700' : 'text-muted'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    <ResultIcon kind={item.kind} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {item.label}
                    </span>
                    {item.detail && (
                      <span className="block truncate text-xs text-muted">{item.detail}</span>
                    )}
                  </span>
                  {item.tag && (
                    <span className="mt-0.5 shrink-0 text-[11px] capitalize text-faint">
                      {item.tag}
                    </span>
                  )}
                </button>
              </div>
            );
          })}

          {!loading && results.length === 0 && (
            <p className="px-2.5 py-3 text-sm text-muted">
              {error ?? `No places found for “${trimmed}”.`}
            </p>
          )}

          <p className="border-t border-line px-2.5 pb-1 pt-2 text-[10px] text-faint">
            Place search by Photon · © OpenStreetMap contributors
          </p>
        </div>
      )}
    </div>
  );
}
