import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { SiteShell } from '../components/site-shell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SubSync | Subscription Tracker',
  description: 'Track subscriptions, renewals, and recurring spend locally.',
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('subsync-theme');
    var dark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
