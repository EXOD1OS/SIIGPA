'use client';

import { CAMPOS_ASPECTOS, type AspectosGeneralesPaad, type CatedraPaad } from '@/types/paad';

/** Selector de la cátedra desde la que se proyectan los Aspectos Generales del PAAD. */
export function SelectorCatedraPaad({
  id,
  etiqueta,
  catedras,
  value,
  onChange,
}: {
  id: string;
  etiqueta: string;
  catedras: CatedraPaad[];
  value: string | null;
  onChange: (asignaturaId: string) => void;
}) {
  if (catedras.length === 0) {
    return <p className="text-[11px] italic text-muted">El docente no integra equipos de cátedra en este ciclo.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
      <label htmlFor={id} className="text-[11px] font-semibold text-muted">
        {etiqueta}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={catedras.length < 2}
        className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary disabled:opacity-80 sm:max-w-md"
      >
        {catedras.map((c) => (
          <option key={c.asignaturaId} value={c.asignaturaId}>
            {c.label} {c.esResponsable ? '(Responsable)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Ficha "Aspectos Generales" (solo lectura): se proyecta según la materia consultada. */
export function AspectosGeneralesPaadCard({ aspectos }: { aspectos: AspectosGeneralesPaad }) {
  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs sm:grid-cols-2 lg:grid-cols-3">
      {CAMPOS_ASPECTOS.map(({ key, label }) => (
        <div key={key} className="bg-surface px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
          <dd className={`mt-0.5 ${aspectos[key] ? 'text-ink' : 'italic text-muted'}`}>{aspectos[key] || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
