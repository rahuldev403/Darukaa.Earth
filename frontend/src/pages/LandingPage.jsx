import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const STEPS = [
  {
    n: '01',
    title: 'Define a project',
    body: 'Group your restoration or conservation work into projects — a mangrove programme, a watershed, a corridor.',
  },
  {
    n: '02',
    title: 'Draw the site boundary',
    body: 'Trace the exact parcel on satellite imagery. The polygon is stored in PostGIS and its true geodesic area computed to the hectare.',
  },
  {
    n: '03',
    title: 'Read the evidence',
    body: 'Species records, decade-long climate series and carbon estimates are pulled for that precise shape and charted over time.',
  },
];

const SOURCES = [
  {
    name: 'GBIF',
    detail: 'Species occurrence records observed inside your polygon, by year and taxonomic class.',
    tag: 'observed',
    tone: 'text-forest-600',
  },
  {
    name: 'NASA POWER',
    detail: 'Ten years of monthly temperature and precipitation at the site centroid.',
    tag: 'measured',
    tone: 'text-sky-500',
  },
  {
    name: 'PostGIS',
    detail:
      'Geodesic area in hectares, computed from the true boundary rather than a bounding box.',
    tag: 'computed',
    tone: 'text-forest-600',
  },
  {
    name: 'IPCC Tier 1',
    detail: 'Biomass carbon stock and sequestration projections from published default factors.',
    tag: 'modelled',
    tone: 'text-clay-500',
  },
];

const LOTTIE_SRC = '/hero-animation.lottie';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [lottieFailed, setLottieFailed] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Logo onDark className="h-7" />
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn bg-white text-forest-800 hover:bg-forest-50">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn text-white/80 hover:bg-white/10 hover:text-white">
                  Sign in
                </Link>
                <Link to="/register" className="btn bg-white text-forest-800 hover:bg-forest-50">
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden bg-forest-900">
        <div className="surface-grid absolute inset-0 opacity-70" />
        <div
          className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #4da878, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-52 -left-32 h-[34rem] w-[34rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #2f7ea8, transparent 70%)' }}
        />

        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-36 sm:pb-32 sm:pt-44">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-4">
            <div className="animate-fade-up">
              <span className="chip border-white/15 bg-white/10 text-forest-100">
                <span className="h-1.5 w-1.5 rounded-full bg-forest-300" />
                Carbon &amp; biodiversity MRV
              </span>

              <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl">
                Evidence for every
                <span className="text-forest-300"> hectare </span>
                you restore.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-forest-100/80">
                Draw a project site on the map. Darukaa.Earth measures its true area and pulls real
                species and climate records for that exact boundary — so your claims rest on data
                you can point to, not estimates you have to defend.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/register'}
                  className="btn bg-forest-400 px-5 py-2.5 text-forest-900 hover:bg-forest-300"
                >
                  {isAuthenticated ? 'Open dashboard' : 'Start mapping'}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </div>

              <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-7">
                {[
                  ['4', 'live data sources'],
                  ['10 yr', 'climate history'],
                  ['4326', 'WGS84 geometry'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt className="text-2xl font-semibold tabular-nums text-white">{value}</dt>
                    <dd className="mt-0.5 text-xs text-forest-100/60">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {!lottieFailed && (
              <div className="relative hidden lg:-mr-10 lg:block xl:-mr-20">
                <div
                  className="absolute inset-0 -m-12 rounded-full opacity-35 blur-3xl"
                  style={{ background: 'radial-gradient(circle, #4da878, transparent 70%)' }}
                />
                <DotLottieReact
                  src={LOTTIE_SRC}
                  loop
                  autoplay
                  onError={() => setLottieFailed(true)}
                  className="relative w-full scale-125 xl:scale-[1.35]"
                  style={{ aspectRatio: '1 / 1' }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">From boundary to evidence</h2>
          <p className="mt-3 text-body">
            Three steps between drawing a shape and having something you can put in front of a
            verifier.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="card p-6">
              <span className="font-mono text-xs font-medium text-forest-400">{step.n}</span>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <span className="chip">Data provenance</span>
              <h2 className="mt-5 text-2xl font-semibold sm:text-3xl">
                Every number says where it came from.
              </h2>
              <p className="mt-4 leading-relaxed text-body">
                A species observation and a modelled carbon figure are not the same kind of claim.
                Most dashboards render them identically. This one refuses to.
              </p>
              <p className="mt-4 leading-relaxed text-muted">
                Each metric carries its source and whether it was measured or modelled. Modelled
                series render as dashed lines with a badge, so nobody mistakes an estimate for an
                observation — including you, six months from now.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SOURCES.map((source) => (
                <div key={source.name} className="card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{source.name}</h3>
                    <span className={`font-mono text-[11px] ${source.tone}`}>{source.tag}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{source.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-2xl bg-forest-800 px-8 py-14 text-center sm:px-16">
          <div className="surface-grid absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Map your first site in under a minute.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-forest-100/75">
              Create an account, draw a boundary, and watch real biodiversity and climate data land
              against it.
            </p>
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className="btn mt-8 bg-forest-400 px-5 py-2.5 text-forest-900 hover:bg-forest-300"
            >
              {isAuthenticated ? 'Open dashboard' : 'Create an account'}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <Logo className="h-6" />
          <p className="text-xs text-faint">
            Data from GBIF and NASA POWER · Carbon estimates follow IPCC Tier 1 defaults
          </p>
        </div>
      </footer>
    </div>
  );
}
