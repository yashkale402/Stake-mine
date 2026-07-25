import './globals.css';
import React from 'react';
import { Syne, Manrope } from 'next/font/google';
import Providers from './providers';
import Navbar from '@/components/Navbar';
import ErrorBoundary from '@/components/ErrorBoundary';

const display = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
});

const body = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: 'Stake Mine — Real-Time Casino Game',
  description:
    'Production-ready Stake Mine game built with Node.js, Express, MySQL, Redis, Next.js, and Tailwind CSS.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen flex flex-col font-body text-stake-text antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-5 md:px-6 md:py-7">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </Providers>
      </body>
    </html>
  );
}
