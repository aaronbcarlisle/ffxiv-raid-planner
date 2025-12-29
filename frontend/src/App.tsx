import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ToastContainer } from './components/ui/ToastContainer';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { GroupView } from './pages/GroupView';
import { AuthCallback } from './pages/AuthCallback';
import { InviteAccept } from './pages/InviteAccept';
import { initializeAuth } from './stores/authStore';

function App() {
  // Initialize auth on app load (check for existing session)
  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="group/:shareCode" element={<GroupView />} />
        </Route>
        {/* Auth callback route (outside Layout for cleaner UX) */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* Invite accept route (outside Layout for focused experience) */}
        <Route path="/invite/:inviteCode" element={<InviteAccept />} />
      </Routes>
      <ToastContainer />
    </>
  );
}

export default App;
