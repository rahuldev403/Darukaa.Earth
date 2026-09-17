import client from './client.js';

export const listProjects = () => client.get('/projects').then((r) => r.data);

export const createProject = (payload) => client.post('/projects', payload).then((r) => r.data);

export const getProject = (projectId) => client.get(`/projects/${projectId}`).then((r) => r.data);

export const deleteProject = (projectId) => client.delete(`/projects/${projectId}`);

export const listSitesGeoJson = (projectId) =>
  client
    .get('/sites', { params: projectId ? { project_id: projectId } : undefined })
    .then((r) => r.data);

export const createSite = (projectId, payload) =>
  client.post(`/projects/${projectId}/sites`, payload).then((r) => r.data);

export const getSite = (siteId) => client.get(`/sites/${siteId}`).then((r) => r.data);

export const deleteSite = (siteId) => client.delete(`/sites/${siteId}`);

export const getSiteAnalytics = (siteId) =>
  client.get(`/sites/${siteId}/analytics`).then((r) => r.data);
