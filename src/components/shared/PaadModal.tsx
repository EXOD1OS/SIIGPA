'use client';

import { useId, useState } from 'react';
import { Modal, ModalButton } from './Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { PaadDocumentoOficial } from '@/components/paad/PaadDocumentoOficial';
import { SelectorCatedraPaad } from '@/components/paad/CamposPaad';
import { BTN_DESCARGAR_PDF } from '@/components/informes/HojasInformeOficial';
import { imprimirHojaOficial } from '@/components/informes/imprimir';
import type { AspectosGeneralesPaad, CatedraPaad } from '@/types/paad';
import type { PaadData } from '@/types/planificacion';

/** Vista del PAAD con el formato del documento oficial (Anexo III); las decisiones se toman en el formulario. */
export function PaadModal({
  datos,
  estado,
  ciclo,
  docente,
  carreraEval,
  catedras,
  catedraInicial,
  aspectosSinCatedra,
  onCatedraChange,
  onClose,
}: {
  datos: PaadData;
  estado: string;
  ciclo: number;
  docente: string;
  carreraEval: string;
  catedras: CatedraPaad[];
  catedraInicial: string | null;
  aspectosSinCatedra: AspectosGeneralesPaad;
  onCatedraChange?: (asignaturaId: string) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [asig, setAsig] = useState<string | null>(catedraInicial);
  const aspectos = catedras.find((c) => c.asignaturaId === asig)?.aspectos ?? aspectosSinCatedra;
  return (
    <Modal
      open
      onClose={onClose}
      title={`PAAD · ${docente}`}
      widthClass="max-w-4xl"
      headerExtra={
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <StatusBadge estado={estado} />
          <span>
            Anexo III · Ciclo {ciclo} · Evalúa: <strong className="text-ink">{carreraEval}</strong>
          </span>
        </div>
      }
      footer={
        <>
          <button type="button" onClick={imprimirHojaOficial} title="Abre la impresión de la hoja oficial: elegí «Guardar como PDF»" className={BTN_DESCARGAR_PDF}>
            Descargar PDF
          </button>
          <ModalButton variant="primary" onClick={onClose}>
            Cerrar
          </ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-background p-3">
          <SelectorCatedraPaad
            id={`${uid}-catedra`}
            etiqueta="Viendo presentación para la cátedra:"
            catedras={catedras}
            value={asig}
            onChange={(v) => {
              setAsig(v);
              onCatedraChange?.(v);
            }}
          />
        </div>
        <div className="max-h-[62vh] overflow-y-auto rounded-xl bg-[#e6e8ec] p-3 sm:p-6">
          <PaadDocumentoOficial aspectos={aspectos} datos={datos} />
        </div>
      </div>
    </Modal>
  );
}
