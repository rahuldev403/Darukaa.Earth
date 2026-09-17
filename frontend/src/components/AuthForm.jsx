import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to your carbon and biodiversity projects.',
    action: 'Sign in',
    pending: 'Signing in…',
    switchText: 'New here?',
    switchCta: 'Create an account',
    switchTo: '/register',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Start mapping and monitoring project sites.',
    action: 'Create account',
    pending: 'Creating account…',
    switchText: 'Already registered?',
    switchCta: 'Sign in',
    switchTo: '/login',
  },
};

export default function AuthForm({ mode }) {
  const copy = COPY[mode];
  const { login, register, isAuthenticated, booting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);

  if (!booting && isAuthenticated) {
    return <Navigate to={location.state?.from ?? '/'} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    const slowTimer = setTimeout(() => setSlow(true), 4000);

    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-full place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-forest-600 text-sm font-bold text-white">
            D
          </span>
          <span className="text-base font-semibold tracking-tight">Darukaa.Earth</span>
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-danger-500/30 bg-danger-500/5 px-3 py-2 text-sm text-danger-500"
              >
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? copy.pending : copy.action}
            </button>

            {slow && (
              <p className="text-center text-xs text-muted">
                Waking the server — the free tier sleeps when idle. This can take up to a minute.
              </p>
            )}
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-muted">
          {copy.switchText}{' '}
          <Link to={copy.switchTo} className="font-medium text-forest-600 hover:underline">
            {copy.switchCta}
          </Link>
        </p>
      </div>
    </div>
  );
}
