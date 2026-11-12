'use client';

import { InformeDisciplinarForm, InformePedagogicoForm } from './InformesOficiales';
import { informePresentado, type TipoInforme } from './HojasInformeOficial';
import type { ContextoInformes } from '@/types/informes';

/** Informe de un área en lectura (modelo oficial Anexo III / IV) o aviso de pendiente. */
export function InformeLectura({ tipo, contexto }: { tipo: TipoInforme; contexto: ContextoInformes }) {
  if (!informePresentado(contexto, tipo)) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-xs">
        <p className="font-medium text-ink">Pendiente de evaluación</p>
        <p className="mt-1 text-muted">
          Este informe lo emite {tipo === 'pedagogico' ? 'la UAP' : 'la Dirección de Carrera'} al cerrar su revisión desde el PAAC. Todavía no fue emitido.
        </p>
      </div>
    );
  }
  if (tipo === 'disciplinar' && contexto.disciplinar) {
    return <InformeDisciplinarForm encabezado={contexto.encabezado} datos={contexto.disciplinar.datos} obs={contexto.disciplinar.obs} readOnly />;
  }
  if (tipo === 'pedagogico' && contexto.pedagogico) {
    return <InformePedagogicoForm encabezado={contexto.encabezado} equipo={contexto.equipo} datos={contexto.pedagogico.datos} obs={contexto.pedagogico.obs} readOnly />;
  }
  return null;
}
