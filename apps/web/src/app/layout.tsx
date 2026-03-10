import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { SiteShell } from '../components/site-shell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Beacon | Subscription Tracker',
  description: 'Track streaming & media subscriptions in one place.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
