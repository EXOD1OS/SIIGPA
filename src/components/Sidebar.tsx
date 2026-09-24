'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ROL_LABELS } from '@/types/planificacion';

const NAV = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/planificaciones', label: 'Planificaciones' },
];

const NAV_ADMIN = [{ href: '/admin', label: 'Administración' }];

export function Sidebar({ nombre, rol }: { nombre: string; rol: string }) {
  const pathname = usePathname();

  function renderLink(item: { href: string; label: string }) {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
          active ? 'bg-primary/15 text-primary font-medium' : 'text-gray-400 hover:bg-surface hover:text-gray-200'
        }`}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <aside className="no-print w-64 shrink-0 bg-sidebar border-r border-border min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-border">
        <p className="text-white font-semibold leading-tight">SIGA Planificaciones</p>
        <p className="text-xs text-gray-500 mt-0.5">DACEFyN &middot; UNLaR</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(renderLink)}
        {rol === 'ADMINISTRADOR' && NAV_ADMIN.map(renderLink)}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <p className="text-sm text-gray-200 truncate">{nombre}</p>
        <p className="text-xs text-gray-500">{ROL_LABELS[rol] ?? rol}</p>
        <div className="mt-3 flex items-center gap-3">
          <Link href="/cambiar-password" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Cambiar contraseña
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-gray-400 hover:text-danger transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}
