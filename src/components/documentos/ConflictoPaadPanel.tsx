'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resolverConflictoPaad } from '@/actions/paad.actions';
import { AvisoEstado } from '@/prototipo/components/shared/AvisoEstado';

/** Administración: elige qué copia anterior (PAAD por materia) se conserva como PAAD anual del docente. */
export function ConflictoPaadPanel({ paadId, fuentes }: { paadId: string; fuentes: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [fuente, setFuente] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="no-print space-y-3">
      <AvisoEstado tono="observado" titulo="El PAAD tiene copias anteriores distintas.">
        Compará los antecedentes y elegí el contenido que se conserva como PAAD anual. Mientras tanto el formulario y la presentación quedan bloqueados.
      </AvisoEstado>
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-[11px] font-medium text-muted">
          Copia a conservar
          <select value={fuente} onChange={(e) => setFuente(e.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink">
            <option value="">Seleccionar copia</option>
            {fuentes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !fuente}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                await resolverConflictoPaad(paadId, fuente);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'No se pudo resolver el conflicto.');
              }
            })
          }
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          Elegir fuente del PAAD
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </section>
  );
}
