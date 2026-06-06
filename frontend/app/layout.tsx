import type { Metadata } from 'next';
import './globals.css';
import SidebarNav from './SidebarNav';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'DiskMind - Storage Intelligence Platform',
  description: 'Intelligent storage analysis, cleanup, and forecasting for Windows',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ height: '100%', overflow: 'hidden', display: 'flex', background: '#060B18', color: '#e2e8f0' }}>
        <Providers>
          <SidebarNav />
          <main style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
