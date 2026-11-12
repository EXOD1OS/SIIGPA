'use client';

import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/redux/hooks';
import { ROL_LABELS } from '@/types/planificacion';
import { IconCollapse, IconDocs, IconHome, IconInbox, IconStructure, IconUserDoc, IconUsers } from '@/components/layout/icons';

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Solo se marca activa en la ruta exacta (ej. `/admin` no debe activarse en `/admin/usuarios`). */
  exact?: boolean;
}

const STORAGE_KEY = 'siigpa.sidebar.collapsed';

/** Normativa vigente con enlace al Digesto de la UNLaR. */
const NORMATIVA = [
  { label: 'Ord. HCS N° 171/2019', href: 'https://digesto.unlar.edu.ar/archivos/2637_HCS-171-2019_3652187.pdf' },
  { label: 'Ord. HCS N° 219/2022', href: 'https://digesto.unlar.edu.ar/pages/normativa.php?id=3478' },
] as const;

/** Clases para textos que se desvanecen al contraer (solo desde md). */
const fade = (collapsed: boolean) =>
  `whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out ${
    collapsed ? 'md:max-w-0 md:opacity-0' : 'max-w-[12rem] opacity-100'
  }`;

export function Sidebar({ rol }: { rol: string }) {
  const pathname = usePathname();
  const cycle = useAppSelector((s) => s.planification.selectedCycle);
  const [collapsed, setCollapsed] = useState(false);
  const [preferenciaLeida, setPreferenciaLeida] = useState(false);

  // Se lee la preferencia en el cliente (después de hidratar) para no desfasar el HTML del servidor.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* almacenamiento no disponible */
    }
    setPreferenciaLeida(true);
  }, []);

  useEffect(() => {
    if (!preferenciaLeida) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* almacenamiento no disponible: la preferencia solo dura la sesión */
    }
  }, [collapsed, preferenciaLeida]);

  const items = useMemo<NavItem[]>(() => {
    const list: NavItem[] = [
      { href: '/dashboard', label: 'Panel de Inicio', Icon: IconHome },
      { href: '/planificaciones', label: 'Planificaciones (PAAC)', Icon: IconDocs },
    ];
    if (rol === 'DOCENTE') list.push({ href: '/mi-paad', label: 'Mi PAAD Anual', Icon: IconUserDoc });
    if (['UAP', 'DIRECCION_CARRERA', 'ADMINISTRADOR'].includes(rol)) list.push({ href: '/paads', label: 'Bandeja de PAADs', Icon: IconInbox });
    if (rol === 'ADMINISTRADOR') {
      list.push({ href: '/admin', label: 'Estructura y Equipos', Icon: IconStructure, exact: true });
      list.push({ href: '/admin/usuarios', label: 'Usuarios y Accesos', Icon: IconUsers });
    }
    return list;
  }, [rol]);

  const esActiva = ({ href, exact }: NavItem) => pathname === href || (!exact && pathname.startsWith(href + '/'));

  return (
    <aside
      className={`no-print relative z-30 flex w-full shrink-0 select-none flex-col border-b border-border bg-sidebar transition-[width] duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r ${
        collapsed ? 'md:w-[72px]' : 'md:w-64'
      }`}
    >
      {/* Marca */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-[18px]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary font-serif text-lg font-bold text-white shadow-sm">S</div>
        <div className={fade(collapsed)}>
          <span className="block text-base font-bold leading-tight tracking-tight text-ink">SIIGPA</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">Gestión de Planes · UNLaR</span>
        </div>
      </div>

      {/* Botón contraer / expandir (escritorio) */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expandir menú' : 'Contraer menú'}
        className="absolute -right-3 top-[52px] hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-colors duration-200 hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:flex"
      >
        <IconCollapse className={`h-3.5 w-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
      </button>

      <nav aria-label="Navegación principal" className="flex gap-1 overflow-x-auto p-3 md:flex-1 md:flex-col md:space-y-1 md:overflow-x-visible md:overflow-y-auto">
        <div className={`hidden px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted md:block ${fade(collapsed)}`}>{ROL_LABELS[rol] ?? rol}</div>
        {items.map((item) => {
          const { href, label, Icon } = item;
          const active = esActiva(item);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              aria-label={collapsed ? label : undefined}
              className={`group relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:w-full ${
                active ? 'bg-soft font-semibold text-primary' : 'text-muted hover:bg-background hover:text-ink'
              }`}
            >
              {/* Indicador de sección activa */}
              <span
                aria-hidden
                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
              />
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className={`text-left ${fade(collapsed)}`}>{label}</span>

              {/* Tooltip cuando está contraído */}
              {collapsed && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 ml-3 hidden -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-medium text-surface opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 md:block"
                >
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-border p-4 text-[11px] text-muted md:block">
        <div
          className={`space-y-1.5 overflow-hidden whitespace-nowrap transition-[opacity,max-height] duration-300 ease-in-out ${
            collapsed ? 'md:max-h-0 md:opacity-0' : 'max-h-40 opacity-100'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Normativa vigente</div>
          {NORMATIVA.map((n) => (
            <a
              key={n.href}
              href={n.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`${n.label} (se abre en una pestaña nueva)`}
              className="block rounded text-[11px] text-muted transition hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              • {n.label}
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          ))}
          <div className="pt-2 text-[10px] font-semibold text-primary">DACEFyN · Ciclo Lectivo {cycle}</div>
        </div>
        {collapsed && (
          <div className="hidden text-center text-[10px] font-bold text-primary md:block" title={`Ciclo lectivo ${cycle}`}>
            {cycle}
          </div>
        )}
      </div>
    </aside>
  );
}
