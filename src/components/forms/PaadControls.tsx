'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { asignarDireccionPaad, dictaminarPaad, resolverConflictoPaad } from '@/actions/paad.actions';
import { PanelRevision, type AreaRevision } from '@/components/shared/PanelRevision';

export function PaadControls({ paadId, presentacionId, canReview, area, pendientes, canAssign, carreraId, carreras, fuentes }: {
  paadId: string; presentacionId?: string; canReview: boolean;
  /** Área de la sesión revisora (UAP o Dirección). */
  area: AreaRevision | null;
  /** Observaciones del PAAD todavía sin subsanar. */
  pendientes: number;
  canAssign: boolean; carreraId: string | null;
  carreras: { id: string; nombre: string }[]; fuentes: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [direccion, setDireccion] = useState(carreraId ?? '');
  const [fuente, setFuente] = useState('');
  function run(action: () => Promise<void>) {
    setError('');
    start(async () => {
      try { await action(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción.'); }
    });
  }
  const button = 'bg-primary px-4 py-2 rounded-lg text-white text-sm disabled:opacity-50';
  return <div className="space-y-4">
    {fuentes.length > 0 && <section className="border border-warning/40 rounded-lg p-4 space-y-3">
      <p>Hay copias distintas. Compará los antecedentes y seleccioná el contenido del PAAD anual.</p>
      <label className="block">Copia a conservar
        <select value={fuente} onChange={e => setFuente(e.target.value)} className="block w-full">
          <option value="">Seleccionar copia</option>{fuentes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
      </label>
      <button className={button} disabled={pending || !fuente} onClick={() => run(() => resolverConflictoPaad(paadId, fuente))}>Elegir fuente del PAAD</button>
    </section>}
    {canAssign && <section className="border border-border rounded-lg p-4 space-y-3">
      <label className="block">Dirección responsable
        <select value={direccion} onChange={e => setDireccion(e.target.value)} className="block w-full">
          <option value="">Sin asignar</option>{carreras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </label>
      <button className={button} disabled={pending || !direccion} onClick={() => run(() => asignarDireccionPaad(paadId, direccion))}>Asignar Dirección</button>
    </section>}
    {/* Aprobación simple: la decisión de UAP o de la Dirección evaluadora cierra el PAAD. */}
    {canReview && presentacionId && area && <PanelRevision area={area} tipo="PAAD" pendientes={pendientes} pending={pending}
      onObservar={(mensaje) => run(() => dictaminarPaad({ paadId, presentacionId, resultado: 'REQUIERE_CORRECCION', mensaje }))}
      onAprobar={() => run(() => dictaminarPaad({ paadId, presentacionId, resultado: 'FAVORABLE', mensaje: '' }))} />}
    {error && <p role="alert" className="text-danger">{error}</p>}
  </div>;
}
