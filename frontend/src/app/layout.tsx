import './globals.css';
import React from 'react';
import localFont from 'next/font/local';
import Providers from './providers';
import Navbar from '@/components/Navbar';
import ErrorBoundary from '@/components/ErrorBoundary';

// Local fonts — no network call at build time (fixes Docker ETIMEDOUT)
const display = localFont({
  src: [
    { path: '../../public/fonts/Syne-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Syne-Bold.woff2',     weight: '700', style: 'normal' },
    { path: '../../public/fonts/Syne-ExtraBold.woff2',weight: '800', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
});

const body = localFont({
  src: [
    { path: '../../public/fonts/Manrope-Regular.woff2',  weight: '400', style: 'normal' },
    { path: '../../public/fonts/Manrope-Medium.woff2',   weight: '500', style: 'normal' },
    { path: '../../public/fonts/Manrope-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Manrope-Bold.woff2',     weight: '700', style: 'normal' },
    { path: '../../public/fonts/Manrope-ExtraBold.woff2',weight: '800', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
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
