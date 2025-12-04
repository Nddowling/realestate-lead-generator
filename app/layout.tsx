import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'REI Lead Generator | Savannah & Rincon',
  description: 'Wholesale real estate lead generation for Chatham and Effingham County, Georgia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-dark-200 text-white">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
