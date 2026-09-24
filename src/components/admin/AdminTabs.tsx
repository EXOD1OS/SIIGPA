'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Gestión Académica' },
  { href: '/admin/usuarios', label: 'Usuarios' },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-border overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
