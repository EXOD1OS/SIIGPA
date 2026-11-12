'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { InformeLectura } from './InformeLectura';
import { BTN_DESCARGAR_PDF, BTN_VER_PDF, BTN_VOLVER_DIGITAL, HojaOficial, hojaInforme, informePresentado, type TipoInforme } from './HojasInformeOficial';
import { imprimirHojaOficial } from './imprimir';
import type { ContextoInformes } from '@/types/informes';

type ViewMode = 'digital' | 'pdf';

const TABS: { key: TipoInforme; label: string; titulo: string; sinEmitir: string }[] = [
  {
    key: 'pedagogico',
    label: 'Informe Pedagógico (UAP)',
    titulo: 'Informe Pedagógico · UAP (Anexo III — Ord. 219/22)',
    sinEmitir: 'Informe Pedagógico aún no emitido por la UAP',
  },
  {
    key: 'disciplinar',
    label: 'Informe Disciplinar (Dirección)',
    titulo: 'Informe Disciplinar · Dirección de Carrera (Anexo IV — Ord. 219/22)',
    sinEmitir: 'Informe Disciplinar aún no emitido por la Dirección de Carrera',
  },
];

const BADGE = {
  emitido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  pendiente: 'bg-slate-500/15 text-muted',
};

/**
 * Consulta de los informes emitidos de un PAAC, estrictamente de solo lectura (sin aprobar ni editar).
 * A la izquierda las pestañas Pedagógico / Disciplinar; a la derecha «Ver PDF», «Descargar PDF» y
 * «← Volver a vista digital» (réplica 1:1 de las hojas oficiales de la Ord. 219/22).
 */
export function VisorInformes({ contexto, onModoChange }: { contexto: ContextoInformes; onModoChange?: (m: ViewMode) => void }) {
  const [activeTab, setActiveTab] = useState<TipoInforme>(() => (!contexto.pedApproved && contexto.discApproved ? 'disciplinar' : 'pedagogico'));
  const [viewMode, setViewMode] = useState<ViewMode>('digital');
  const uid = useId();

  const presentado = informePresentado(contexto, activeTab);
  const modo: ViewMode = presentado ? viewMode : 'digital';
  const tabActiva = TABS.find((t) => t.key === activeTab) ?? TABS[0];
  const datosTab = activeTab === 'disciplinar' ? contexto.disciplinar : contexto.pedagogico;
  const hoja = presentado ? hojaInforme(activeTab, contexto) : null;

  const cambiarModo = (m: ViewMode) => {
    setViewMode(m);
    onModoChange?.(m);
  };
  const cambiarTab = (t: TipoInforme) => {
    setActiveTab(t);
    if (!informePresentado(contexto, t)) cambiarModo('digital');
  };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next: TipoInforme = activeTab === 'pedagogico' ? 'disciplinar' : 'pedagogico';
    cambiarTab(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Informes de la planificación" className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const activo = activeTab === t.key;
            const emitido = informePresentado(contexto, t.key);
            return (
              <button
                key={t.key}
                id={`${uid}-tab-${t.key}`}
                type="button"
                role="tab"
                aria-selected={activo}
                aria-controls={`${uid}-panel`}
                tabIndex={activo ? 0 : -1}
                onClick={() => cambiarTab(t.key)}
                onKeyDown={onTabKey}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  activo ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.label}
                <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-bold ${emitido ? BADGE.emitido : BADGE.pendiente}`}>
                  {emitido ? 'Favorable' : 'Pendiente'}
                </span>
              </button>
            );
          })}
        </div>

        {presentado && (
          <div className="flex flex-wrap gap-2 pb-2">
            {modo === 'digital' ? (
              <button type="button" onClick={() => cambiarModo('pdf')} className={BTN_VER_PDF}>
                Ver PDF
              </button>
            ) : (
              <button type="button" onClick={() => cambiarModo('digital')} className={BTN_VOLVER_DIGITAL}>
                ← Volver a vista digital
              </button>
            )}
            <button type="button" onClick={imprimirHojaOficial} title="Abre la impresión de la hoja oficial: elegí «Guardar como PDF»" className={BTN_DESCARGAR_PDF}>
              Descargar PDF
            </button>
          </div>
        )}
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${activeTab}`}>
        {!presentado ? (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">{tabActiva.sinEmitir}</p>
            <p className="mt-1 text-xs text-muted">Se podrá consultar aquí cuando su dictamen favorable quede emitido desde el PAAC.</p>
          </div>
        ) : (
          modo === 'digital' && (
            <>
              <h3 className="mb-3 text-xs font-semibold text-ink">
                {tabActiva.titulo}
                {datosTab?.firmante && (
                  <span className="block text-[11px] font-normal text-muted">
                    Emitido por {datosTab.firmante}
                    {datosTab.fecha && ` · ${datosTab.fecha}`}
                  </span>
                )}
              </h3>
              <InformeLectura tipo={activeTab} contexto={contexto} />
            </>
          )
        )}
        {/* La copia de impresión se monta siempre que haya hoja: «Descargar PDF» funciona también desde la vista digital. */}
        {hoja && <HojaOficial key={activeTab} hoja={hoja} visible={modo === 'pdf'} />}
      </div>
    </div>
  );
}
