import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ReleaseBanner } from './ReleaseBanner';

export function Layout() {
  return (
    <div className="min-h-screen bg-surface-base">
      <Header />
      <ReleaseBanner />
      <main className="max-w-[120rem] mx-auto px-4 py-3">
        <Outlet />
      </main>
    </div>
  );
}
