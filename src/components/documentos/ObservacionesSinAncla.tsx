'use client';

import { ObservationFieldWrapper } from '@/components/ObservationFieldWrapper';
import type { ObservacionDoc } from '@/prototipo/types/planificacion';

/**
 * Observaciones registradas antes del editor actual (sin campo del prototipo al que anclarse).
 * Se listan aparte para que el docente pueda subsanarlas y UAP/Dirección eliminarlas: si no, bloquearían la aprobación.
 */
export function ObservacionesSinAncla({
  comments,
  tipo,
  documentoId,
  canResolve,
  rolEliminacion,
}: {
  comments: ObservacionDoc[];
  tipo: 'PAAC' | 'PAAD';
  documentoId: string;
  canResolve: boolean;
  rolEliminacion: string | null;
}) {
  const sinAncla = comments.filter((o) => !o.field && !o.resolved);
  if (sinAncla.length === 0) return null;
  return (
    <section className="no-print space-y-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-bold text-ink">Observaciones generales</h2>
        <p className="mt-0.5 text-[11px] text-muted">Observaciones sin campo asociado (registradas antes del formulario actual o en el dictamen).</p>
      </div>
      {sinAncla.map((o) => (
        <ObservationFieldWrapper
          key={o.id}
          {...(tipo === 'PAAC' ? { planificacionId: documentoId } : { paadAnualId: documentoId })}
          documentoTipo={tipo}
          fieldPath={o.campoPath ?? 'general'}
          observaciones={[{ id: o.id, mensaje: o.text ?? '', rolAutor: o.area === 'direccion' ? 'DIRECCION_CARRERA' : 'UAP', resuelto: o.resolved }]}
          canResolve={canResolve}
          rolEliminacion={rolEliminacion}
        >
          <p className="font-mono text-[11px] text-muted">
            {o.campoPath ?? 'general'}
            {o.author && ` · ${o.author}`}
            {o.date && ` · ${o.date}`}
          </p>
        </ObservationFieldWrapper>
      ))}
    </section>
  );
}
