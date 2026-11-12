'use client';

import { useId, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AspectosGeneralesPaadCard, SelectorCatedraPaad } from './CamposPaad';
import { PaadModal } from '@/components/shared/PaadModal';
import { BTN_VER_PDF } from '@/components/informes/HojasInformeOficial';
import type { AspectosGeneralesPaad, CatedraPaad } from '@/types/paad';
import type { PaadData } from '@/types/planificacion';

/**
 * Aspectos Generales del PAAD proyectados según la materia consultada (`?asignatura=`).
 * Los puntos 1) a 8) no cambian: son únicos por docente y ciclo lectivo.
 */
export function PaadEncabezadoDinamico(props: {
  catedras: CatedraPaad[];
  catedraInicial: string | null;
  aspectosSinCatedra: AspectosGeneralesPaad;
  datos: PaadData;
  estado: string;
  ciclo: number;
  docente: string;
  carreraEval: string;
}) {
  const { catedras, catedraInicial, aspectosSinCatedra } = props;
  const uid = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [asig, setAsig] = useState<string | null>(catedraInicial);
  const [modal, setModal] = useState(false);
  const aspectos = catedras.find((c) => c.asignaturaId === asig)?.aspectos ?? aspectosSinCatedra;

  const elegir = (v: string) => {
    setAsig(v);
    const q = new URLSearchParams(params.toString());
    q.set('asignatura', v);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <section aria-labelledby={`${uid}-titulo`} className="no-print space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Anexo III · Ord. 171/19</p>
          <h2 id={`${uid}-titulo`} className="text-base font-bold text-ink">
            Aspectos Generales
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">Se proyectan según la cátedra consultada; los puntos 1) al 8) son únicos para el ciclo.</p>
        </div>
        <button type="button" onClick={() => setModal(true)} className={BTN_VER_PDF}>
          Ver documento oficial / PDF
        </button>
      </div>
      <SelectorCatedraPaad id={`${uid}-catedra`} etiqueta="Cátedra:" catedras={catedras} value={asig} onChange={elegir} />
      <AspectosGeneralesPaadCard aspectos={aspectos} />
      {modal && (
        <PaadModal
          datos={props.datos}
          estado={props.estado}
          ciclo={props.ciclo}
          docente={props.docente}
          carreraEval={props.carreraEval}
          catedras={catedras}
          catedraInicial={asig}
          aspectosSinCatedra={aspectosSinCatedra}
          onCatedraChange={elegir}
          onClose={() => setModal(false)}
        />
      )}
    </section>
  );
}
