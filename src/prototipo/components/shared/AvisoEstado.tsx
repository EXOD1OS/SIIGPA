'use client';

import type { ReactNode } from 'react';
import { IconAlert, IconCheck, IconClock, IconLock, IconSeal } from '../layout/icons';
import { esReenvio } from '../../lib/revision';
import type { InformeEvaluacion } from '../../types/planificacion';

export type TonoAviso = 'lectura' | 'observado' | 'revision' | 'listo' | 'tramite' | 'protocolizado';

const TONOS: Record<TonoAviso, { Icon: typeof IconLock; caja: string; icono: string; rol: 'note' | 'status' }> = {
  // Presentado / bloqueado: tinte del color institucional (los tokens CSS no admiten el modificador `/NN`).
  lectura: {
    Icon: IconLock,
    caja: 'border-[color:color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--primary)_15%,transparent)]',
    icono: 'bg-[color:color-mix(in_srgb,var(--primary)_18%,transparent)] text-primary',
    rol: 'note',
  },
  observado: {
    Icon: IconAlert,
    caja: 'border-amber-500/30 bg-amber-500/10 dark:border-amber-400/30 dark:bg-amber-500/15',
    icono: 'bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300',
    rol: 'status',
  },
  revision: {
    Icon: IconClock,
    caja: 'border-sky-500/30 bg-sky-500/10 dark:border-sky-400/30 dark:bg-sky-500/15',
    icono: 'bg-sky-500/20 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300',
    rol: 'note',
  },
  listo: {
    Icon: IconCheck,
    caja: 'border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-400/30 dark:bg-emerald-500/15',
    icono: 'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300',
    rol: 'status',
  },
  /** Elevado al Consejo: expediente caratulado, resolución pendiente. */
  tramite: {
    Icon: IconClock,
    caja: 'border-indigo-500/30 bg-indigo-500/10 dark:border-indigo-400/30 dark:bg-indigo-500/15',
    icono: 'bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300',
    rol: 'status',
  },
  /** Finalizado: protocolizado e inmutable. */
  protocolizado: {
    Icon: IconSeal,
    caja: 'border-emerald-600/40 bg-emerald-500/15 dark:border-emerald-400/30 dark:bg-emerald-500/20',
    icono: 'bg-emerald-600/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300',
    rol: 'status',
  },
};

/** Ícono destacado del aviso (candado, alerta, reloj…) en el color semántico del estado. */
export function IconoEstado({ tono, className = 'h-9 w-9' }: { tono: TonoAviso; className?: string }) {
  const { Icon, icono } = TONOS[tono];
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl ${icono} ${className}`}>
      <Icon className="h-5 w-5 stroke-[2.2]" />
    </span>
  );
}

export function AvisoEstado({
  tono,
  titulo,
  etiqueta,
  accion,
  children,
}: {
  tono: TonoAviso;
  titulo: string;
  etiqueta?: string;
  /** Acción en el propio aviso (ej. «Cargar Resolución» para el Consejo). */
  accion?: ReactNode;
  children?: ReactNode;
}) {
  const t = TONOS[tono];
  return (
    <div role={t.rol} className={`flex w-full flex-wrap items-center justify-start gap-3.5 rounded-2xl border px-5 py-3.5 text-left shadow-sm sm:flex-nowrap ${t.caja}`}>
      <IconoEstado tono={tono} />
      <div className="min-w-0 flex-1 text-left">
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold tracking-tight text-ink">
          {etiqueta && (
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.icono}`}>{etiqueta}</span>
          )}
          {titulo}
        </p>
        {children && <div className="mt-0.5 text-xs leading-relaxed text-muted">{children}</div>}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}

/** Aviso que corresponde al documento según su estado y los permisos de la sesión (null = ninguno). */
export function avisoDeDocumento(opts: {
  d: { state: string; pedReport?: InformeEvaluacion; discReport?: InformeEvaluacion; expediente?: string; resolucion?: string };
  tipo: 'PAAC' | 'PAAD';
  canEdit: boolean;
  canObserve: boolean;
  esDocente: boolean;
  /** Observaciones que el docente todavía no marcó como subsanadas. */
  pendientes: number;
}): { tono: TonoAviso; titulo: string; texto?: string; etiqueta?: string } | null {
  const { d, tipo, canEdit, canObserve, esDocente, pendientes } = opts;
  // Protocolización del PAAC (Consejo Departamental): prevalece sobre cualquier otro aviso.
  if (d.state === 'FINALIZADO') {
    return {
      tono: 'protocolizado',
      titulo: `Planificación Finalizada y Protocolizada (Inmutable) · Expediente: ${d.expediente || '—'} · Resolución: ${d.resolucion || '—'}`,
      texto: 'El documento quedó cerrado de forma permanente: no admite cambios, observaciones ni modificaciones de los informes.',
    };
  }
  if (d.state === 'ELEVADO_AL_CONSEJO') {
    return {
      tono: 'tramite',
      titulo: `En trámite de Resolución · Expediente N° ${d.expediente || '—'} (Pendiente de carga de Resolución del Consejo Superior)`,
      texto: 'El documento está en lectura mientras el Consejo Superior emite la Resolución.',
    };
  }
  const enCorreccion = esReenvio(d);
  if (canEdit) {
    if (!enCorreccion) return null;
    return {
      tono: 'observado',
      // En el PAAC la etapa de corrección se rotula "Correcciones".
      etiqueta: tipo === 'PAAC' ? 'Correcciones' : undefined,
      titulo: 'Documento con observaciones pendientes de corrección.',
      texto:
        pendientes > 0
          ? `Edite los apartados señalados y vuelva a presentar. Quedan ${pendientes} observación(es) por marcar como subsanada(s).`
          : 'Edite los apartados señalados y vuelva a presentar. Todas las observaciones están subsanadas.',
    };
  }
  if (canObserve) {
    return {
      tono: 'revision',
      titulo: 'Revisión en curso.',
      texto: 'Anclá las observaciones en los apartados y cerrá tu revisión con el panel de decisión.',
    };
  }
  if (['BORRADOR', 'OBSERVADO'].includes(d.state) || enCorreccion) {
    return esDocente
      ? {
          tono: 'lectura',
          titulo: 'Modo lectura.',
          texto: tipo === 'PAAC' ? 'Solo el Docente Responsable de la cátedra edita y presenta el PAAC.' : 'Solo el docente titular del PAAD puede editarlo.',
        }
      : {
          tono: enCorreccion ? 'observado' : 'lectura',
          etiqueta: enCorreccion && tipo === 'PAAC' ? 'Correcciones' : undefined,
          titulo: 'Vista de consulta.',
          texto: enCorreccion ? 'El documento fue devuelto al docente con observaciones pendientes.' : 'El documento todavía no fue presentado.',
        };
  }
  return {
    tono: 'lectura',
    etiqueta: tipo === 'PAAC' && d.state === 'ENVIADO_A_REVISION' ? 'Presentado' : undefined,
    titulo: 'El documento ya fue presentado y se encuentra bloqueado en modo lectura.',
    texto: INSTANCIA[d.state],
  };
}

/** Instancia actual del documento presentado (subtítulo del aviso de bloqueo). */
const INSTANCIA: Record<string, string> = {
  ENVIADO_A_REVISION: 'En revisión por UAP / Dirección de Carrera',
  APROBADO_PEDAGOGICO: 'Aprobado por la UAP · Pendiente del Informe Disciplinar de la Dirección de Carrera',
  APROBADO_DISCIPLINAR: 'Aprobado por la Dirección de Carrera · Pendiente del Informe Pedagógico de la UAP',
  APROBADO_PLENO: 'Aprobado por UAP y Dirección de Carrera · Pendiente de elevación por el Consejo Departamental',
  APROBADO: 'PAAD aprobado',
};
