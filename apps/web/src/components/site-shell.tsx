'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/utils';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/connect', label: 'Connect' },
  { href: '/subscriptions/new', label: 'Add subscription' },
  { href: '/settings', label: 'Settings' },
];

export const SiteShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Beacon</p>
            <h1 className="text-lg font-semibold text-slate-900">
              Subscription Command
            </h1>
          </div>
          <nav className="flex gap-3 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-2 font-medium text-slate-600 transition-colors',
                  pathname?.startsWith(link.href)
                    ? 'bg-slate-900 text-white'
                    : 'hover:bg-slate-100',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
};
