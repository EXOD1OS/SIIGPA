'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { marcarComoObservado, registrarAprobacionDisciplinar, registrarAprobacionPedagogica } from '@/actions/planificacion.actions';
import { PanelRevision, btnAprobar, btnSecundario, type AreaRevision } from '@/components/shared/PanelRevision';
import { IconCheck } from '@/components/layout/icons';
import { InformeDisciplinarForm, InformePedagogicoForm } from './InformesOficiales';
import type { EncabezadoInforme, InformeDisciplinarDatos, InformePedagogicoDatos, IntegranteInforme } from '@/types/informes';

type Props = {
  planificacionId: string;
  pendientes: number;
  encabezado: EncabezadoInforme;
  equipo: IntegranteInforme[];
  obsSugerida: string;
} & (
  | { area: 'uap'; sugerido: InformePedagogicoDatos }
  | { area: 'direccion'; sugerido: InformeDisciplinarDatos }
);

/**
 * Dictamen de UAP o Dirección desde adentro del PAAC. Al aprobar se abre EXCLUSIVAMENTE el informe del rol
 * (UAP → Pedagógico, Dirección → Disciplinar), autocompletado con los datos reales del PAAC y de los PAAD
 * del equipo, para revisarlo/editarlo antes de confirmar.
 */
export function EvaluacionInforme(props: Props) {
  const { planificacionId, pendientes, encabezado, equipo, obsSugerida, area } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [ped, setPed] = useState<InformePedagogicoDatos | null>(props.area === 'uap' ? props.sugerido : null);
  const [disc, setDisc] = useState<InformeDisciplinarDatos | null>(props.area === 'direccion' ? props.sugerido : null);
  const [obs, setObs] = useState(obsSugerida);

  const run = (fn: () => Promise<unknown>, alTerminar?: () => void) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        alTerminar?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
      }
    });
  };

  const confirmar = () =>
    run(
      () =>
        area === 'uap' && ped
          ? registrarAprobacionPedagogica(planificacionId, { pedagogico: ped, observaciones: obs })
          : disc
            ? registrarAprobacionDisciplinar(planificacionId, { disciplinar: disc, observaciones: obs })
            : Promise.resolve(),
      () => setAbierto(false),
    );

  if (!abierto) {
    return (
      <PanelRevision
        area={area as AreaRevision}
        tipo="PAAC"
        pendientes={pendientes}
        pending={pending}
        error={error}
        onObservar={() => run(() => marcarComoObservado(planificacionId))}
        onAprobar={() => setAbierto(true)}
      />
    );
  }

  return (
    <section aria-label={area === 'uap' ? 'Emisión del Informe Pedagógico' : 'Emisión del Informe Disciplinar'} className="no-print space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <p className="rounded-lg border border-border bg-soft px-3 py-2 text-[11px] text-ink">
        Los campos se completaron automáticamente con el contenido del PAAC{area === 'direccion' ? ' y el estado de los PAAD del equipo' : ''}. Revisalos antes de confirmar.
      </p>
      {area === 'uap' && ped ? (
        <InformePedagogicoForm encabezado={encabezado} equipo={equipo} datos={ped} obs={obs} readOnly={false} onChange={setPed} onObs={setObs} />
      ) : disc ? (
        <InformeDisciplinarForm encabezado={encabezado} datos={disc} obs={obs} readOnly={false} onChange={setDisc} onObs={setObs} />
      ) : null}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => setAbierto(false)} disabled={pending} className={btnSecundario}>
          ← Volver
        </button>
        <button type="button" onClick={confirmar} disabled={pending} className={`${btnAprobar} sm:flex-none`}>
          <IconCheck className="h-4 w-4" />
          {pending ? 'Emitiendo…' : area === 'uap' ? 'Confirmar y emitir Informe Pedagógico' : 'Confirmar y emitir Informe Disciplinar'}
        </button>
      </div>
    </section>
  );
}
