'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { enviarARevision } from '@/actions/planificacion.actions';
import { hasRole } from '@/lib/roles';
import { AccionProtocolo, type DocProtocolo } from '@/components/planificaciones/ProtocolizacionModal';
import { IconLock } from '@/components/layout/icons';

interface Props {
  planificacionId: string;
  estado: string;
  rol: UserRole;
  esResponsable: boolean;
  /** Datos para la protocolización del Consejo Departamental (2 instancias). */
  protocolo: DocProtocolo;
}

/** Acciones del circuito: envío a revisión (docente) y protocolización en 2 instancias (Consejo). */
export function AccionesPanel({ planificacionId, estado, rol, esResponsable, protocolo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const puedeEnviar = ['BORRADOR', 'OBSERVADO'].includes(estado) && (esResponsable || rol === UserRole.ADMINISTRADOR);
  const puedeProtocolizar = ['APROBADO_PLENO', 'ELEVADO_AL_CONSEJO'].includes(estado) && hasRole(rol, [UserRole.CONSEJO_DEPARTAMENTAL, UserRole.ADMINISTRADOR]);
  const inmutable = ['ELEVADO_AL_CONSEJO', 'FINALIZADO'].includes(estado);

  if (!puedeEnviar && !puedeProtocolizar && !inmutable) return null;

  return (
    <div className="space-y-3">
      {inmutable && (
        <p role="note" className="flex items-start gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2.5 text-xs text-indigo-800 dark:text-indigo-200">
          <IconLock className="mt-0.5 h-4 w-4 shrink-0" />
          {estado === 'FINALIZADO'
            ? 'Planificación finalizada con Resolución: el documento, sus observaciones e informes son inmutables.'
            : 'Planificación elevada al Consejo: el documento, sus observaciones e informes quedan en solo lectura.'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {puedeEnviar && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await enviarARevision(planificacionId);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Ocurrió un error.');
                }
              });
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? 'Procesando…' : 'Enviar a Revisión'}
          </button>
        )}
        {puedeProtocolizar && <AccionProtocolo doc={protocolo} />}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
