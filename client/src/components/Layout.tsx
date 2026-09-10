import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <>
      <Sidebar />
      <main>
        <Header />
        <section id="view-root" key={location.pathname} className="view-enter">{children}</section>
      </main>
    </>
  );
}
