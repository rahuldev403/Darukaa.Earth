import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to your carbon and biodiversity projects.',
    action: 'Sign in',
    pending: 'Signing in…',
    switchText: 'New to Darukaa.Earth?',
    switchCta: 'Create an account',
    switchTo: '/register',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Start mapping and monitoring project sites.',
    action: 'Create account',
    pending: 'Creating account…',
    switchText: 'Already have an account?',
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

  const destination = location.state?.from ?? '/dashboard';

  if (!booting && isAuthenticated) {
    return <Navigate to={destination} replace />;
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
      navigate(destination, { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-7">
          <Logo className="h-7" />
        </div>

        <div className="card p-7">
          <h1 className="text-[22px] font-semibold">{copy.title}</h1>
          <p className="mt-1.5 text-sm text-muted">{copy.subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="label">
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
                placeholder="you@organisation.org"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
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
                className="rounded-lg border border-danger-500/25 bg-danger-500/5 px-3 py-2 text-sm text-danger-500"
              >
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {submitting ? copy.pending : copy.action}
            </button>

            {slow && (
              <p className="text-center text-xs leading-relaxed text-muted">
                Waking the server — the free tier sleeps when idle. This can take up to a minute.
              </p>
            )}
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          {copy.switchText}{' '}
          <Link to={copy.switchTo} className="font-medium text-forest-600 hover:underline">
            {copy.switchCta}
          </Link>
        </p>
      </div>
    </div>
  );
}
