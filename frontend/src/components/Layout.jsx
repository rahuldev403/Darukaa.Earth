import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import Logo from './Logo.jsx';

import { useAuth } from '../context/AuthContext.jsx';

const navLinkClass = ({ isActive }) =>
  [
    'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
    isActive
      ? 'bg-forest-50 text-forest-700'
      : 'text-muted hover:bg-forest-50/60 hover:text-forest-700',
  ].join(' ');

function initialsOf(email) {
  return (email ?? '?').slice(0, 2).toUpperCase();
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="flex flex-col bg-canvas" style={{ height: '100dvh' }}>
      <header className="z-20 flex shrink-0 items-center gap-6 border-b border-line bg-surface/85 px-5 py-2.5 backdrop-blur-md">
        <Logo to="/dashboard" className="h-6" />

        <nav className="flex items-center gap-1">
          <NavLink to="/dashboard" className={navLinkClass}>
            Projects
          </NavLink>
          <NavLink to="/map" className={navLinkClass}>
            Map
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-full bg-forest-100 text-[11px] font-semibold text-forest-700"
            title={user?.email}
          >
            {initialsOf(user?.email)}
          </span>
          <span className="hidden max-w-[16rem] truncate text-sm text-muted lg:inline">
            {user?.email}
          </span>
          <button type="button" onClick={handleLogout} className="btn btn-secondary">
            Sign out
          </button>
        </div>
      </header>

      <main className="relative overflow-auto" style={{ flex: '1 1 0%', minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
