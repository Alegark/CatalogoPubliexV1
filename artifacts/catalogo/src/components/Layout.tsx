import React from 'react';
import { useLocation } from 'wouter';
import { Header } from './Header';
import { CartDrawer } from './CartDrawer';
import { FloatingCartButton } from './FloatingCartButton';
import { CookieConsent } from './CookieConsent';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isAdminRoute = /^\/admin(?:\/|$)/i.test(location);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
      {!isAdminRoute && <FloatingCartButton />}
      <CartDrawer />
      {!isAdminRoute && <CookieConsent />}
      {!isAdminRoute && (
        <footer className="mt-auto bg-primary px-4 py-7 pb-24 text-sm text-white sm:px-6 sm:pb-7">
          <div className="mx-auto grid max-w-7xl gap-5 text-center sm:grid-cols-2 sm:items-center sm:text-left">
            <div>
              <p className="font-semibold">Publiex Maracaibo</p>
              <p className="mt-1 text-sm text-white/75">Soluciones en acrílico para tu negocio.</p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-white/85">&copy; {new Date().getFullYear()} Publiex Maracaibo.</p>
              <p className="mt-1 text-sm text-white/75">Página creada por Ing. Diego García.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
