'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { consolidarExpedienteAction } from '@/actions/archivo.actions';

/** Genera y sube a S3/MinIO el expediente PDF de una planificación finalizada sin archivos. */
export function ConsolidarExpedienteButton({ planificacionId }: { planificacionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMensaje(null);
            try {
              const { archivados } = await consolidarExpedienteAction(planificacionId);
              setMensaje(`${archivados} archivo(s) consolidados.`);
              router.refresh();
            } catch (e) {
              setMensaje(e instanceof Error ? e.message : 'No se pudo consolidar el expediente.');
            }
          })
        }
        className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? 'Consolidando…' : 'Consolidar y subir expediente PDF'}
      </button>
      {mensaje && <span className="text-xs text-muted">{mensaje}</span>}
    </div>
  );
}
