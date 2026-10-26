import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
export const metadata: Metadata = { title: 'Haven | Learning space', description: 'Haven School of Therapy' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Suspense fallback={<p role="status">Loading…</p>}>{children}</Suspense></body></html>;
}
