'use client';

import { useId, useState } from 'react';
import { IconCheck, IconReturn, IconSeal } from '@/components/layout/icons';

export type AreaRevision = 'uap' | 'direccion';

export const AREA_LABEL: Record<AreaRevision, { corto: string; dictamen: string }> = {
  uap: { corto: 'UAP', dictamen: 'dictamen pedagógico' },
  direccion: { corto: 'Dirección de Carrera', dictamen: 'dictamen disciplinar' },
};

export const APROBAR_INFORME: Record<AreaRevision, string> = {
  uap: 'Aprobar Informe Pedagógico',
  direccion: 'Aprobar Informe Disciplinar',
};

export const btnObservar =
  'w-full sm:w-auto flex-1 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-600 text-amber-800 dark:text-amber-300 hover:text-white border border-amber-500/40 font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-500/15 disabled:hover:text-amber-800';
export const btnAprobar =
  'w-full sm:w-auto flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600';
export const btnSecundario =
  'w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border bg-surface text-xs font-medium text-ink transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

interface Props {
  area: AreaRevision;
  tipo: 'PAAC' | 'PAAD';
  /** Observaciones de esta área todavía sin subsanar. */
  pendientes: number;
  pending?: boolean;
  error?: string | null;
  /** "Enviar con revisiones": el documento vuelve al docente (PAAD: con el comentario del dictamen). */
  onObservar: (mensaje: string) => void;
  /** PAAC: abre el informe oficial autocompletado; PAAD: aprueba directamente tras confirmar. */
  onAprobar: () => void;
}

/** Dictamen de UAP / Dirección: enviar con revisiones (vuelve al docente) o aprobar. */
export function PanelRevision({ area, tipo, pendientes, pending = false, error, onObservar, onAprobar }: Props) {
  const [confirmando, setConfirmando] = useState<'OBSERVADO' | 'FAVORABLE' | null>(null);
  const [mensaje, setMensaje] = useState('');
  const idAyuda = useId();
  const idTitulo = useId();
  const idMsg = useId();
  const etiqueta = AREA_LABEL[area];
  const esPaad = tipo === 'PAAD';
  const bloqueaFavorable = pendientes > 0;
  const informe = area === 'uap' ? 'Informe Pedagógico' : 'Informe Disciplinar';
  const etiquetaAprobar = esPaad ? 'Aprobar PAAD' : APROBAR_INFORME[area];
  const etiquetaObservar = esPaad ? 'Enviar con revisiones (Observado)' : 'Enviar con revisiones';
  // PAAD: el envío con revisiones registra un dictamen con comentario obligatorio.
  const faltaMensaje = esPaad && confirmando === 'OBSERVADO' && !mensaje.trim();

  const confirmar = () => {
    if (confirmando === 'OBSERVADO') onObservar(mensaje.trim());
    else if (confirmando === 'FAVORABLE') onAprobar();
    setConfirmando(null);
  };
  // PAAC: el favorable no se emite en seco, abre el informe del área para revisarlo.
  const aprobar = () => (esPaad ? setConfirmando('FAVORABLE') : onAprobar());

  return (
    <section aria-labelledby={idTitulo} className="no-print space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-soft text-primary">
          <IconSeal className="h-4 w-4" />
        </span>
        <div className="min-w-0 text-xs">
          <h2 id={idTitulo} className="font-semibold text-ink">
            Dictamen · {etiqueta.corto}
          </h2>
          <p className="mt-0.5 text-muted">
            {esPaad ? 'Aprobá el PAAD u observalo: basta con la decisión de la UAP o de la Dirección de Carrera.' : `Emití el ${etiqueta.dictamen} del ${tipo}.`}{' '}
            {pendientes > 0 ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">Tenés {pendientes} observación(es) sin subsanar.</span>
            ) : (
              'No hay observaciones abiertas de tu área.'
            )}
          </p>
        </div>
      </div>

      {confirmando ? (
        <div role="group" aria-label="Confirmar dictamen" className="space-y-3 rounded-xl border border-border bg-surface p-3">
          <p className="text-xs font-medium text-ink">
            {confirmando === 'OBSERVADO'
              ? `El ${tipo} vuelve al docente en estado Observado y se habilita su edición para corregir. ¿Confirmás?`
              : 'El PAAD queda Aprobado y se cierra su revisión. ¿Confirmás?'}
          </p>
          {esPaad && confirmando === 'OBSERVADO' && (
            <div>
              <label htmlFor={idMsg} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                Corrección requerida
              </label>
              <textarea
                id={idMsg}
                rows={3}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Describí qué debe corregir el docente…"
                className="w-full rounded-lg border border-border bg-background p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setConfirmando(null)} className={btnSecundario}>
              Cancelar
            </button>
            <button type="button" autoFocus={!esPaad} disabled={pending || faltaMensaje} onClick={confirmar} className={confirmando === 'OBSERVADO' ? btnObservar : btnAprobar}>
              {confirmando === 'OBSERVADO' ? <IconReturn className="h-4 w-4" /> : <IconCheck className="h-4 w-4" />}
              {confirmando === 'OBSERVADO' ? 'Sí, enviar con revisiones' : `Sí, ${etiquetaAprobar.toLowerCase()}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={pending} onClick={() => setConfirmando('OBSERVADO')} title={`Devuelve el ${tipo} al docente con las observaciones`} className={btnObservar}>
            <IconReturn className="h-4 w-4" />
            {etiquetaObservar}
          </button>
          <button
            type="button"
            onClick={aprobar}
            disabled={pending || bloqueaFavorable}
            aria-describedby={idAyuda}
            title={esPaad ? undefined : `Abre el ${informe} autocompletado para revisarlo y confirmarlo`}
            className={btnAprobar}
          >
            <IconCheck className="h-4 w-4" />
            {pending ? 'Procesando…' : etiquetaAprobar}
          </button>
        </div>
      )}

      {!confirmando && (
        <p id={idAyuda} className="text-[11px] text-muted">
          {bloqueaFavorable
            ? 'Para aprobar, el docente debe subsanar las observaciones. También podés eliminar las que cargaste por error.'
            : esPaad
              ? 'La aprobación de cualquiera de las dos áreas deja el PAAD Aprobado.'
              : `Al aprobar se abre el ${informe} con los datos del ${tipo} ya completados: revisalos y confirmá el envío.`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
