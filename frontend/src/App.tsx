import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { CreateStatic } from './pages/CreateStatic';
import { StaticView } from './pages/StaticView';
import { Dashboard } from './pages/Dashboard';
import { AuthCallback } from './pages/AuthCallback';
import { initializeAuth } from './stores/authStore';

function App() {
  // Initialize auth on app load (check for existing session)
  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="create" element={<CreateStatic />} />
        <Route path="static/:shareCode" element={<StaticView />} />
        <Route path="dashboard" element={<Dashboard />} />
        {/* Group routes - new static group system */}
        <Route path="group/:shareCode" element={<StaticView />} />
      </Route>
      {/* Auth callback route (outside Layout for cleaner UX) */}
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  );
}

export default App;
