import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiError } from '../api/client.js';
import { createProject, listProjects } from '../api/resources.js';

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function ProjectCard({ project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="card group flex flex-col p-5 transition-shadow hover:shadow-md"
    >
      <h3 className="font-semibold tracking-tight group-hover:text-forest-700">{project.name}</h3>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">
        {project.description || 'No description provided.'}
      </p>

      <div className="mt-4 flex items-center gap-5 border-t border-line pt-3">
        <div>
          <p className="text-lg font-semibold tabular-nums">{project.site_count ?? 0}</p>
          <p className="text-xs text-muted">Sites</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">
            {numberFormat.format(project.total_area_ha ?? 0)}
          </p>
          <p className="text-xs text-muted">Hectares</p>
        </div>
      </div>
    </Link>
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

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            Carbon and biodiversity programmes, each with mapped field sites.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setFormOpen((v) => !v)}>
          {formOpen ? 'Cancel' : 'New project'}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={handleCreate} className="card mt-5 space-y-4 p-5">
          <div>
            <label htmlFor="project-name" className="mb-1.5 block text-sm font-medium">
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
            <label htmlFor="project-description" className="mb-1.5 block text-sm font-medium">
              Description <span className="font-normal text-muted">(optional)</span>
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

          <button type="submit" disabled={saving || !name.trim()} className="btn-primary">
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </form>
      )}

      <div className="mt-6">
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-40 animate-pulse bg-forest-50/40" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="card p-6 text-center">
            <p className="text-sm text-danger-500">{error}</p>
            <button type="button" onClick={load} className="btn-primary mt-4">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="card p-10 text-center">
            <h3 className="font-semibold">No projects yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Create a project, then draw its field sites on the map to pull in biodiversity and
              climate data.
            </p>
            <button type="button" className="btn-primary mt-5" onClick={() => setFormOpen(true)}>
              Create your first project
            </button>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
