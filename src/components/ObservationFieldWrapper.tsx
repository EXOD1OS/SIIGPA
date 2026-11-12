'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { eliminarObservacionAction as eliminarObsPaad, observarPaad, resolverObservacionPaad } from '@/actions/paad.actions';
import { agregarObservacion, eliminarObservacionAction as eliminarObsPaac, resolverObservacion } from '@/actions/planificacion.actions';
import { IconAlert, IconCheck } from '@/components/layout/icons';

interface Observacion {
  id: string;
  mensaje: string;
  rolAutor: string;
  resuelto: boolean;
}

interface Props {
  planificacionId?: string;
  paadAnualId?: string;
  presentacionId?: string;
  documentoTipo: 'PAAC' | 'PAAD';
  docentePaadId?: string;
  fieldPath: string;
  observaciones?: Observacion[];
  canObserve?: boolean;
  canResolve?: boolean;
  /**
   * Rol de la sesión cuando el documento admite eliminar observaciones (no FINALIZADO / no APROBADO).
   * UAP y Dirección ven «Eliminar» solo en las de su área; el Administrador, en todas.
   */
  rolEliminacion?: string | null;
  children: React.ReactNode;
}

/** UAP y Dirección eliminan solo las observaciones de su área; el Administrador, cualquiera. */
export function puedeEliminarObservacion(rol: string | null | undefined, rolAutor: string) {
  return !!rol && (rol === 'ADMINISTRADOR' || ((rol === 'UAP' || rol === 'DIRECCION_CARRERA') && rol === rolAutor));
}

const AREA: Record<string, { nombre: string; tarjeta: string; autor: string; icono: string }> = {
  UAP: {
    nombre: 'UAP',
    tarjeta: 'border-amber-500/30 bg-amber-500/10',
    autor: 'text-amber-700 dark:text-amber-300',
    icono: 'border-amber-500/20 bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  DIRECCION_CARRERA: {
    nombre: 'Dirección',
    tarjeta: 'border-sky-500/30 bg-sky-500/10',
    autor: 'text-sky-700 dark:text-sky-300',
    icono: 'border-sky-500/20 bg-sky-500/15 text-sky-600 dark:text-sky-400',
  },
};
const AREA_OTRA = { nombre: 'Administración', tarjeta: 'border-border bg-background', autor: 'text-ink', icono: 'border-border bg-soft text-primary' };

/** Campo del documento con sus observaciones (UAP / Dirección): anclar, subsanar y eliminar. */
export function ObservationFieldWrapper({
  planificacionId,
  paadAnualId,
  presentacionId,
  documentoTipo,
  docentePaadId,
  fieldPath,
  observaciones = [],
  canObserve = false,
  canResolve = false,
  rolEliminacion,
  children,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [pending, startTransition] = useTransition();

  const pendientes = observaciones.filter((o) => !o.resuelto);
  const hasObs = pendientes.length > 0;

  const ejecutar = (fn: () => Promise<unknown>, mensajeError: string, alTerminar?: () => void) =>
    startTransition(async () => {
      setError(null);
      try {
        await fn();
        alTerminar?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : mensajeError);
      }
    });

  function submitObservacion() {
    if (!mensaje.trim()) return;
    ejecutar(
      () => {
        if (paadAnualId && presentacionId) return observarPaad({ paadId: paadAnualId, presentacionId, campoPath: fieldPath, mensaje });
        if (planificacionId) return agregarObservacion({ planificacionId, documentoTipo, campoPath: fieldPath, mensaje, docentePaadId });
        throw new Error('Documento no disponible.');
      },
      'No se pudo registrar la observación.',
      () => {
        setMensaje('');
        setOpen(false);
      },
    );
  }

  return (
    <div className={`rounded-lg p-2 transition-colors ${hasObs ? 'bg-amber-500/5 ring-2 ring-amber-500/50' : ''}`}>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      {hasObs && (
        <div className="mt-2 space-y-2">
          {pendientes.map((obs) => {
            const a = AREA[obs.rolAutor] ?? AREA_OTRA;
            return (
              <div key={obs.id} className={`space-y-2 rounded-xl border p-3 text-xs ${a.tarjeta}`}>
                <div className="flex items-start gap-2.5">
                  <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${a.icono}`}>
                    <IconAlert className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-[11px] font-bold ${a.autor}`}>{a.nombre}</span>
                      {puedeEliminarObservacion(rolEliminacion, obs.rolAutor) && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => ejecutar(() => (paadAnualId ? eliminarObsPaad(obs.id) : eliminarObsPaac(obs.id)), 'No se pudo eliminar la observación.')}
                          aria-label={`Eliminar observación de ${a.nombre}`}
                          className="shrink-0 rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-danger transition hover:bg-rose-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rose-500 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink">{obs.mensaje}</p>
                    <p className="mt-1 text-[10px] text-muted">Pendiente de subsanación</p>
                  </div>
                </div>
                {canResolve && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => ejecutar(() => (paadAnualId ? resolverObservacionPaad(obs.id) : resolverObservacion(obs.id)), 'No se pudo resolver.')}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500 disabled:opacity-50"
                  >
                    <IconCheck className="h-3.5 w-3.5" />
                    Marcar como subsanada
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canObserve && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
        >
          <span aria-hidden className="text-sm leading-none">
            +
          </span>{' '}
          Anclar observación
        </button>
      )}

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-dashed border-border bg-background p-3">
          <textarea
            rows={2}
            className="w-full rounded-lg border border-border bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            placeholder="Describir la corrección requerida…"
            autoFocus
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !mensaje.trim()}
              onClick={submitObservacion}
              className="flex-1 rounded-lg bg-primary py-1.5 text-[11px] font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anclar observación al campo
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 text-[11px] text-muted hover:text-ink">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
