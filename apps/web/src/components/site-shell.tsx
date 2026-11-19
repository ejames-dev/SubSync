'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { listEmailReceipts } from '../lib/api';
import { cn } from '../lib/utils';
import { NotificationPoller } from './notification-poller';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/insights/yearly-review', label: 'Yearly review' },
  { href: '/connect', label: 'Connect' },
  { href: '/imports/review', label: 'Imports' },
  { href: '/subscriptions/new', label: 'Add subscription' },
  { href: '/settings', label: 'Settings' },
];

export const SiteShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    let active = true;
    void listEmailReceipts('review')
      .then((receipts) => {
        if (!active) return;
        const itemCount = receipts.reduce(
          (sum, receipt) =>
            sum +
            receipt.items.filter((item) => item.action === 'review').length,
          0,
        );
        setPendingReviewCount(itemCount);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pathname]);

  const toggleTheme = () => {
    const nextDark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', nextDark);
    try {
      localStorage.setItem('subsync-theme', nextDark ? 'dark' : 'light');
    } catch {
      // Ignore storage access errors.
    }
    setDarkMode(nextDark);
  };

  return (
    <div className="min-h-screen bg-slate-50 transition-colors dark:bg-slate-950">
      <NotificationPoller />
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              SubSync
            </p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Subscription Command
            </h1>
          </div>
          <nav
            aria-label="Primary navigation"
            className="flex flex-wrap items-center gap-2 text-sm md:gap-2.5"
          >
            {navLinks.map((link) => {
              const isActive = pathname?.startsWith(link.href);
              const showBadge =
                link.href === '/imports/review' && pendingReviewCount > 0;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-2 font-medium text-slate-600 transition-colors dark:text-slate-300',
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                  )}
                >
                  <span>{link.label}</span>
                  {showBadge ? (
                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
                      {pendingReviewCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                darkMode ? 'Switch to light mode' : 'Switch to dark mode'
              }
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {darkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
};
