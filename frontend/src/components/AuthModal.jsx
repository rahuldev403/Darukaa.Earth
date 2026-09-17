import { useEffect, useRef, useState } from 'react';

import { apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const MODES = ['login', 'register'];

const COPY = {
  login: {
    tab: 'Sign in',
    title: 'Welcome back',
    subtitle: 'Sign in to your carbon and biodiversity projects.',
    action: 'Sign in',
    pending: 'Signing in…',
  },
  register: {
    tab: 'Create account',
    title: 'Create your account',
    subtitle: 'Start mapping and monitoring project sites.',
    action: 'Create account',
    pending: 'Creating account…',
  },
};

export default function AuthModal({ open, initialMode = 'login', onClose, onSuccess }) {
  const { login, register } = useAuth();

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);

  const emailRef = useRef(null);
  const previousMode = useRef(initialMode);

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, submitting, onClose]);

  useEffect(() => {
    if (open) emailRef.current?.focus();
  }, [open, mode]);

  if (!open) return null;

  const copy = COPY[mode];
  const direction = MODES.indexOf(mode) > MODES.indexOf(previousMode.current) ? 12 : -12;
  previousMode.current = mode;

  const switchMode = (next) => {
    if (next === mode || submitting) return;
    setMode(next);
    setError(null);
  };

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
      onSuccess?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => !submitting && onClose?.()}
        className="animate-fade-in absolute inset-0 cursor-default bg-forest-900/55 backdrop-blur-sm"
      />

      <div className="animate-modal-in relative w-full max-w-sm">
        <div className="card p-6 shadow-float">
          <div className="flex rounded-xl bg-canvas p-1">
            {MODES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                aria-pressed={mode === value}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  mode === value ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'
                }`}
              >
                {COPY[value].tab}
              </button>
            ))}
          </div>

          <div
            key={mode}
            className="animate-swap-in mt-6"
            style={{ '--swap-from': `${direction}px` }}
          >
            <h2 id="auth-modal-title" className="text-xl font-semibold">
              {copy.title}
            </h2>
            <p className="mt-1.5 text-sm text-muted">{copy.subtitle}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="auth-email" className="label">
                  Email
                </label>
                <input
                  id="auth-email"
                  ref={emailRef}
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
                <label htmlFor="auth-password" className="label">
                  Password
                </label>
                <input
                  id="auth-password"
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
        </div>
      </div>
    </div>
  );
}
