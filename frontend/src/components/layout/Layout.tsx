import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ReleaseBanner } from './ReleaseBanner';
import { ViewAsBanner } from '../admin';

export function Layout() {
  return (
    <div className="min-h-screen bg-surface-base">
      <Header />
      <ViewAsBanner />
      <ReleaseBanner />
      <main className="max-w-[120rem] mx-auto px-4 py-3">
        <Outlet />
      </main>
    </div>
  );
}
