'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/leads', label: 'Leads', icon: '🎯' },
  { href: '/pipeline', label: 'Pipeline', icon: '📈' },
  { href: '/buyers', label: 'Buyers', icon: '🤝' },
  { href: '/analyzer', label: 'Deal Analyzer', icon: '🔢' },
  { href: '/sources', label: 'Data Sources', icon: '📥' },
  { href: '/attom', label: 'ATTOM Data', icon: '🏠' },
  { href: '/analytics', label: 'Analytics', icon: '📉' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-dark-200 border-r border-slate-800 min-h-screen p-4 flex flex-col">
      {/* Logo */}
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="text-primary-500">💰</span>
          REI Leads
        </h1>
        <p className="text-slate-500 text-sm mt-1">Savannah & Rincon</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Quick Stats */}
      <div className="mt-auto pt-4 border-t border-slate-800">
        <div className="bg-dark-100 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Quick Stats</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Hot Leads</span>
              <span className="text-red-400 font-semibold">--</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">This Week</span>
              <span className="text-primary-400 font-semibold">--</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
