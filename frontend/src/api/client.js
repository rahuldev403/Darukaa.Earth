import axios from 'axios';

export const TOKEN_KEY = 'darukaa.token';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const client = axios.create({
  baseURL: `${baseURL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const onAuthPage = ['/login', '/register'].includes(window.location.pathname);

    if (status === 401 && !onAuthPage) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export function apiError(error, fallback = 'Something went wrong. Please try again.') {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg ?? String(d)).join(', ');
  }

  if (error?.code === 'ECONNABORTED') {
    return 'The server took too long to respond. It may be waking up - try again.';
  }

  if (!error?.response) {
    return 'Cannot reach the server. Check your connection.';
  }

  return fallback;
}

export default client;
