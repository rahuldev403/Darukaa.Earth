import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiError } from '../api/client.js';
import { getSiteAnalytics } from '../api/resources.js';
import MetricChart, { ProvenanceBadge } from '../components/MetricChart.jsx';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const precise = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const STATUS_COPY = {
  pending: 'Data ingest in progress',
  partial: 'Partial data — one source was unavailable',
  failed: 'Data ingest failed for this site',
};

function KpiCard({ kpi }) {
  const value = Number(kpi.value ?? 0);
  const display = Math.abs(value) >= 10000 ? compact.format(value) : precise.format(value);

  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{kpi.label}</p>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums">
        {display}
        <span className="ml-1 text-sm font-normal text-muted">{kpi.unit}</span>
      </p>
      <div className="mt-3">
        <ProvenanceBadge source={kpi.source} isModeled={kpi.is_modeled} />
      </div>
    </div>
  );
}

function TaxaBreakdown({ taxa }) {
  if (!taxa?.length) return null;

  const max = Math.max(...taxa.map((t) => t.count));

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold leading-snug">Taxonomic composition</h3>
          <p className="mt-0.5 text-xs text-muted">Occurrence records by class</p>
        </div>
        <ProvenanceBadge source="GBIF" isModeled={false} />
      </div>

      <ul className="mt-4 space-y-3">
        {taxa.map((taxon) => (
          <li key={taxon.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium italic">{taxon.name}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {compact.format(taxon.count)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-forest-50">
              <div
                className="h-full rounded-full bg-forest-500 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(2, (taxon.count / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteDetailPage() {
  const { siteId } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAnalytics(await getSiteAnalytics(siteId));
    } catch (err) {
      setError(apiError(err, 'Could not load analytics for this site.'));
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-9">
        <div className="skeleton h-7 w-52 rounded-lg" />
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card skeleton h-28 border-transparent" />
          ))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="card skeleton h-64 border-transparent" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-9">
        <div className="card p-10 text-center">
          <p className="text-sm text-danger-500">{error}</p>
          <button type="button" onClick={load} className="btn btn-primary mt-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    kpis = [],
    series = [],
    taxa = [],
    data_quality: quality,
    ingest_status: status,
  } = analytics ?? {};

  return (
    <div className="mx-auto max-w-5xl animate-fade-up px-5 py-9">
      <Link
        to="/map"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-forest-700"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13 8H3m4-4-4 4 4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to map
      </Link>

      <div className="mt-3.5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold">{analytics?.site_name ?? `Site ${siteId}`}</h1>
          <p className="mt-1 text-sm text-muted">
            {analytics?.project_name ? `${analytics.project_name} · ` : ''}
            <span className="tabular-nums">{precise.format(analytics?.area_ha ?? 0)}</span> hectares
          </p>
        </div>

        {status && status !== 'complete' && (
          <span className="chip border-amber-500/30 bg-amber-500/8 text-amber-500">
            {STATUS_COPY[status] ?? status}
          </span>
        )}
      </div>

      {quality?.is_sparse && (
        <div className="card mt-5 border-amber-500/25 bg-amber-500/5 p-4">
          <p className="text-sm leading-relaxed">
            <span className="font-medium">Limited data for this area. </span>
            <span className="text-muted">
              {quality.message ??
                'Few biodiversity records exist here, so trends should be read with caution.'}
            </span>
          </p>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {series.map((s) => (
          <MetricChart key={s.metric_type} series={s} />
        ))}
        <TaxaBreakdown taxa={taxa} />
      </div>

      {series.length === 0 && taxa.length === 0 && (
        <div className="card mt-5 p-12 text-center">
          <h3 className="font-semibold">No analytics yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
            External data sources returned nothing for this polygon.
          </p>
        </div>
      )}

      <p className="mt-8 text-center text-xs leading-relaxed text-faint">
        Measured values come from GBIF occurrence records and NASA POWER climate reanalysis.
        Modelled values apply IPCC Tier 1 default factors to the measured area.
      </p>
    </div>
  );
}
