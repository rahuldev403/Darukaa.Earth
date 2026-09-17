import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LandingPage from './pages/LandingPage.jsx';

const MapPage = lazy(() => import('./pages/MapPage.jsx'));
const SiteDetailPage = lazy(() => import('./pages/SiteDetailPage.jsx'));

function RouteFallback() {
  return (
    <div className="grid h-full place-items-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-forest-600" />
    </div>
  );
}

const lazyRoute = (element) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Navigate to="/" replace state={{ authMode: 'login' }} />} />
      <Route
        path="/register"
        element={<Navigate to="/" replace state={{ authMode: 'register' }} />}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/map" element={lazyRoute(<MapPage />)} />
          <Route path="/projects/:projectId" element={lazyRoute(<MapPage />)} />
          <Route path="/sites/:siteId" element={lazyRoute(<SiteDetailPage />)} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
