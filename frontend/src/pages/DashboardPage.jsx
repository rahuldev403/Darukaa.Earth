import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiError } from '../api/client.js';
import { createProject, deleteProject, listProjects } from '../api/resources.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function SummaryStat({ label, value, suffix }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-muted">{suffix}</span>}
      </p>
    </div>
  );
}

function ProjectCard({ project, onRequestDelete }) {
  return (
    <div className="card group relative flex flex-col p-5 transition-colors hover:border-line-strong">
      <button
        type="button"
        aria-label={`Delete ${project.name}`}
        title="Delete project"
        onClick={() => onRequestDelete(project)}
        className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-faint opacity-0 transition-all hover:bg-danger-500/10 hover:text-danger-500 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 4.5h10M6.5 4.5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Link to={`/projects/${project.id}`} className="flex flex-1 flex-col">
        <h3 className="pr-7 font-semibold leading-snug transition-colors group-hover:text-forest-700">
          {project.name}
        </h3>

        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted">
          {project.description || 'No description provided.'}
        </p>

        <div className="mt-5 flex items-center gap-6 border-t border-line pt-3.5">
          <div>
            <p className="text-lg font-semibold tabular-nums">{project.site_count ?? 0}</p>
            <p className="text-[11px] text-muted">{project.site_count === 1 ? 'Site' : 'Sites'}</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {numberFormat.format(project.total_area_ha ?? 0)}
            </p>
            <p className="text-[11px] text-muted">Hectares</p>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjects());
    } catch (err) {
      setError(apiError(err, 'Could not load your projects.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setFormError(null);
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || null,
      });
      setProjects((current) => [project, ...current]);
      setName('');
      setDescription('');
      setFormOpen(false);
    } catch (err) {
      setFormError(apiError(err, 'Could not create the project.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProject(pendingDelete.id);
      setProjects((current) => current.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(apiError(err, 'Could not delete the project.'));
    } finally {
      setDeleting(false);
    }
  };

  const totalSites = projects.reduce((sum, p) => sum + (p.site_count ?? 0), 0);
  const totalArea = projects.reduce((sum, p) => sum + (p.total_area_ha ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            Carbon and biodiversity programmes, each with mapped field sites.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/map" className="btn btn-secondary">
            Open map
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? 'Cancel' : 'New project'}
          </button>
        </div>
      </div>

      {!loading && !error && projects.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryStat label="Projects" value={projects.length} />
          <SummaryStat label="Mapped sites" value={totalSites} />
          <SummaryStat label="Total area" value={numberFormat.format(totalArea)} suffix="ha" />
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleCreate} className="card mt-5 animate-fade-up space-y-4 p-6">
          <div>
            <label htmlFor="project-name" className="label">
              Project name
            </label>
            <input
              id="project-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Western Ghats Restoration"
            />
          </div>

          <div>
            <label htmlFor="project-description" className="label">
              Description <span className="font-normal text-faint">(optional)</span>
            </label>
            <textarea
              id="project-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input resize-none"
              placeholder="Native shola reforestation across degraded slopes."
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-danger-500">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary">
              {saving ? 'Creating…' : 'Create project'}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card skeleton h-40 border-transparent" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="card p-8 text-center">
            <p className="text-sm text-danger-500">{error}</p>
            <button type="button" onClick={load} className="btn btn-primary mt-4">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="card p-12 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-600">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M3 6.5 7.5 4 12.5 6.5 17 4v9.5L12.5 16 7.5 13.5 3 16V6.5ZM7.5 4v9.5M12.5 6.5V16"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h3 className="mt-4 font-semibold">No projects yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
              Create a project, then draw its field sites on the map to pull in biodiversity and
              climate data for each boundary.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-6"
              onClick={() => setFormOpen(true)}
            >
              Create your first project
            </button>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onRequestDelete={setPendingDelete} />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        body={
          pendingDelete?.site_count
            ? `This permanently removes the project, its ${pendingDelete.site_count} site${
                pendingDelete.site_count === 1 ? '' : 's'
              } and all analytics collected for them. This cannot be undone.`
            : 'This permanently removes the project. This cannot be undone.'
        }
        confirmLabel="Delete project"
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
