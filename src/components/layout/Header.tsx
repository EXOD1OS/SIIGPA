'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useAppSelector } from '@/redux/hooks';
import { ROL_LABELS } from '@/types/planificacion';
import { StatusBadge } from '@/components/StatusBadge';
import { CambiarPasswordModal } from '@/components/shared/CambiarPasswordModal';
import { useTheme } from '@/components/theme/ThemeProvider';
import { IconAlert, IconBell, IconCheck, IconChevronDown, IconChevronRight, IconClock, IconKey, IconLogout, IconMoon, IconSun } from './icons';

export interface NotificationItem {
  /** Identificador estable que cambia con el estado del documento (vuelve a figurar como no leída). */
  id: string;
  /** warning: requiere corrección · revision: tarea pendiente · info: recordatorio · success: aprobación. */
  tipo: 'warning' | 'revision' | 'info' | 'success';
  /** Ruta a la que lleva la notificación (ej. `/planificaciones/<id>`). */
  href: string;
  title: string;
  subtitle: string;
  state: string;
  unresolvedCount: number;
}

interface Props {
  /** Id del usuario: las notificaciones leídas se recuerdan por usuario en este navegador. */
  uid: string;
  nombre: string;
  rol: string;
  /** La cuenta usa una contraseña provisoria: el modal se abre solo y no se puede cerrar. */
  mustChangePassword: boolean;
  notifications?: NotificationItem[];
}

const TONO: Record<NotificationItem['tipo'], { Icon: typeof IconAlert; cls: string }> = {
  warning: { Icon: IconAlert, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  revision: { Icon: IconClock, cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  info: { Icon: IconBell, cls: 'bg-soft text-primary' },
  success: { Icon: IconCheck, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
};

const claveLeidas = (uid: string) => `siigpa.notif.leidas.${uid}`;

/** Ids leídos guardados en el navegador (si el almacenamiento no está disponible, solo dura la sesión). */
function useLeidas(uid: string, vigentes: string[]) {
  const [leidas, setLeidas] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(claveLeidas(uid)) ?? '[]');
      if (Array.isArray(guardadas)) setLeidas(new Set(guardadas.filter((x): x is string => typeof x === 'string')));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [uid]);
  const marcar = (ids: string[]) =>
    setLeidas((prev) => {
      const next = new Set([...prev, ...ids]);
      // Solo se conservan las vigentes: las de documentos que cambiaron se descartan.
      const conservar = [...next].filter((id) => vigentes.includes(id));
      try {
        localStorage.setItem(claveLeidas(uid), JSON.stringify(conservar));
      } catch {
        /* almacenamiento no disponible */
      }
      return new Set(conservar);
    });
  return { leidas, marcar };
}

/** Clases de un panel desplegable con entrada/salida suave. */
const panelCls = (open: boolean) =>
  `absolute right-0 top-full z-50 mt-2 origin-top-right rounded-2xl border border-border bg-surface shadow-2xl transition-all duration-200 ease-out ${
    open ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible -translate-y-1 scale-95 opacity-0 pointer-events-none'
  }`;

const iconBtnCls =
  'relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-ink transition-colors duration-200 hover:border-primary hover:bg-soft hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function GrupoNotif({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <div className="sticky top-0 z-10 bg-surface px-4 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted backdrop-blur">{titulo}</div>
      <ul className="space-y-2 px-3 pb-3">{children}</ul>
    </div>
  );
}

export function Header({ uid, nombre, rol, mustChangePassword, notifications = [] }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const { isDark, toggleTheme } = useTheme();
  const cycle = useAppSelector((s) => s.planification.selectedCycle);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  // Paneles cerrados: `inert` los saca del foco y de la lectura (React 18 no serializa bien el atributo).
  useEffect(() => {
    if (notifPanelRef.current) notifPanelRef.current.inert = !notifOpen;
    if (menuPanelRef.current) menuPanelRef.current.inert = !menuOpen;
  }, [notifOpen, menuOpen]);

  const rolLabel = ROL_LABELS[rol] ?? rol;
  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0] || '')
    .join('')
    .toUpperCase();

  const { leidas, marcar } = useLeidas(uid, notifications.map((n) => n.id));
  const noLeidas = notifications.filter((n) => !leidas.has(n.id));
  const unreadCount = noLeidas.length;
  const atencion = notifications.filter((n) => n.tipo === 'warning' || n.tipo === 'revision');
  const resto = notifications.filter((n) => n.tipo !== 'warning' && n.tipo !== 'revision');

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const logout = () => signOut({ callbackUrl: '/login' });

  // Tras el cambio: se refresca el JWT (relee `mustChangePassword`) y el layout del servidor.
  const onPasswordChanged = async () => {
    await update();
    router.refresh();
  };

  const renderNotif = (n: NotificationItem) => {
    const { Icon, cls } = TONO[n.tipo];
    const leida = leidas.has(n.id);
    return (
      <li key={n.id}>
        <button
          type="button"
          onClick={() => {
            marcar([n.id]);
            setNotifOpen(false);
            router.push(n.href);
          }}
          aria-label={`${leida ? '' : 'No leída: '}${n.title}. ${n.subtitle}${n.unresolvedCount > 0 ? `. Observaciones: ${n.unresolvedCount}` : ''}`}
          className={`group relative flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 hover:border-[color:color-mix(in_srgb,var(--primary)_40%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--soft)_50%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            leida
              ? 'border-[color:color-mix(in_srgb,var(--border)_80%,transparent)] bg-[color:color-mix(in_srgb,var(--bg)_60%,transparent)]'
              : 'border-[color:color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--primary)_5%,transparent)]'
          }`}
        >
          {/* Ícono (columna izquierda) */}
          <span aria-hidden className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cls}`}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            {/* Fila 1: instrumento + estado (y punto de no leída) */}
            <span className="flex items-start justify-between gap-2">
              <span className={`line-clamp-2 text-xs font-bold leading-snug ${leida ? 'text-muted' : 'text-ink'}`}>{n.title}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <StatusBadge estado={n.state} />
                {!leida && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </span>
            </span>
            {/* Fila 2: metadatos + observaciones */}
            <span className="mt-1.5 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] text-muted" title={n.subtitle}>{n.subtitle}</span>
              {n.unresolvedCount > 0 && (
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-500">Observaciones: {n.unresolvedCount}</span>
              )}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <header className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-[color:color-mix(in_srgb,var(--surface)_82%,transparent)] px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="font-semibold text-ink">DACEFyN</span>
          <span aria-hidden>/</span>
          <span>UNLaR</span>
          <span className="ml-2 rounded-md bg-soft px-2 py-0.5 text-[11px] font-bold text-primary">Ciclo {cycle}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tema claro / oscuro: el ícono gira y se intercambia */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Activar tema claro' : 'Activar tema oscuro'}
            title={isDark ? 'Tema claro' : 'Tema oscuro'}
            className={`${iconBtnCls} overflow-hidden`}
          >
            <IconSun
              data-theme-anim
              className={`absolute h-[18px] w-[18px] text-amber-500 transition-all duration-500 ease-out ${isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-50 opacity-0'}`}
            />
            <IconMoon
              data-theme-anim
              className={`absolute h-[18px] w-[18px] text-indigo-500 transition-all duration-500 ease-out ${isDark ? '-rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
            />
          </button>

          {/* Notificaciones */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((o) => !o);
                setMenuOpen(false);
              }}
              aria-label={`Notificaciones${unreadCount ? `: ${unreadCount} sin leer` : ''}`}
              aria-expanded={notifOpen}
              aria-haspopup="dialog"
              className={`${iconBtnCls} ${notifOpen ? 'border-primary bg-soft text-primary' : ''}`}
            >
              <IconBell className={`h-[18px] w-[18px] transition-transform duration-300 ${notifOpen ? 'rotate-12' : ''}`} />
              {unreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-40 motion-reduce:animate-none" />
                  <span className="relative flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold tabular-nums text-white ring-2 ring-surface">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                </span>
              )}
            </button>

            <div
              role="dialog"
              aria-label="Notificaciones"
              aria-hidden={!notifOpen}
              ref={notifPanelRef}
              className={`${panelCls(notifOpen)} w-80 max-w-[calc(100vw-2rem)] overflow-hidden sm:w-96`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-ink">
                    Notificaciones
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-bold tabular-nums text-white">{unreadCount}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted">
                    {unreadCount ? `${unreadCount} sin leer` : notifications.length ? 'Todas leídas' : 'Todo al día'}
                    {atencion.length > 0 && ` · ${atencion.length} requieren tu atención`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => marcar(notifications.map((n) => n.id))}
                  disabled={unreadCount === 0}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-soft disabled:pointer-events-none disabled:opacity-40"
                >
                  Marcar todas como leídas
                </button>
              </div>

              <div className="max-h-[22rem] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft text-primary">
                      <IconBell className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-sm font-medium text-ink">Sin notificaciones</p>
                    <p className="mt-1 text-xs text-muted">Te avisaremos cuando haya novedades en tus planificaciones.</p>
                  </div>
                ) : (
                  <>
                    {atencion.length > 0 && <GrupoNotif titulo="Requieren atención">{atencion.map(renderNotif)}</GrupoNotif>}
                    {resto.length > 0 && <GrupoNotif titulo="Seguimiento">{resto.map(renderNotif)}</GrupoNotif>}
                  </>
                )}
              </div>

              <div className="border-t border-border p-2">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    router.push('/planificaciones');
                  }}
                  className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-primary transition-colors hover:bg-soft"
                >
                  Ver todas las planificaciones <IconChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Usuario */}
          <div className="relative border-l border-border pl-2.5" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen((o) => !o);
                setNotifOpen(false);
              }}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2.5 rounded-xl p-1 pr-2 text-left transition-colors duration-200 hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">{initials}</span>
              <span className="hidden sm:block">
                <span className="block text-xs font-semibold leading-none text-ink">{nombre}</span>
                <span className="mt-1 block text-[10px] text-muted">{rolLabel}</span>
              </span>
              <IconChevronDown className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            <div role="menu" aria-hidden={!menuOpen} ref={menuPanelRef} className={`${panelCls(menuOpen)} w-56 p-1.5 text-xs`}>
              <div className="px-3 py-2">
                <div className="truncate font-semibold text-ink">{nombre}</div>
                <div className="text-[11px] text-muted">{rolLabel}</div>
              </div>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setPasswordOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-ink transition-colors hover:bg-soft hover:text-primary"
              >
                <IconKey className="h-4 w-4" /> Cambiar contraseña
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-danger transition-colors hover:bg-red-500/10"
              >
                <IconLogout className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <CambiarPasswordModal
        open={passwordOpen || mustChangePassword}
        activeUserName={nombre}
        rolLabel={rolLabel}
        obligatorio={mustChangePassword}
        onClose={() => setPasswordOpen(false)}
        onSuccess={onPasswordChanged}
        onLogout={logout}
      />
    </>
  );
}
