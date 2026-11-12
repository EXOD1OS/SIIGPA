'use client';

import { useEffect, useState } from 'react';
import { Modal, ModalButton } from '@/components/shared/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { obtenerInformesAction } from '@/actions/planificacion.actions';
import { VisorInformes } from './VisorInformes';
import type { ContextoInformes } from '@/types/informes';

/**
 * Consulta de los informes de una planificación desde la bandeja, en un único modal y estrictamente
 * en solo lectura: los informes no se emiten ni se aprueban desde aquí, solo entrando al PAAC.
 */
export function InformesModal({
  planificacionId,
  asignatura,
  subtitulo,
  estado,
  onClose,
}: {
  planificacionId: string;
  asignatura: string;
  subtitulo: string;
  estado: string;
  onClose: () => void;
}) {
  const [contexto, setContexto] = useState<ContextoInformes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<'digital' | 'pdf'>('digital');

  useEffect(() => {
    let vigente = true;
    obtenerInformesAction(planificacionId)
      .then((c) => vigente && setContexto(c))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : 'No se pudieron cargar los informes.'));
    return () => {
      vigente = false;
    };
  }, [planificacionId]);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Informes de evaluación · ${asignatura}`}
      widthClass={modo === 'pdf' ? 'max-w-6xl' : 'max-w-3xl'}
      headerExtra={
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <StatusBadge estado={estado} />
          <span>{subtitulo}</span>
        </div>
      }
      footer={<ModalButton onClick={onClose}>Cerrar</ModalButton>}
    >
      <div className="max-h-[65vh] overflow-y-auto pr-1">
        {error ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        ) : !contexto ? (
          <p className="py-10 text-center text-xs text-muted">Cargando informes…</p>
        ) : (
          <VisorInformes contexto={contexto} onModoChange={setModo} />
        )}
      </div>
    </Modal>
  );
}
