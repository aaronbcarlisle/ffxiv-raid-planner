import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />
      <main className="max-w-[120rem] mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
