'use client';

// Bandejas literales del prototipo (PlanificacionesList / PaadsListView) con los datos de Prisma.
import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlanificacionesList } from '@/prototipo/components/views/PlanificacionesList';
import { PaadsListView } from '@/prototipo/components/views/PaadsListView';
import { ProtocolizacionModal } from '@/prototipo/components/planificaciones/ProtocolizacionModal';
import { Toast, type ToastTone } from '@/prototipo/components/shared/Toast';
import { esEditablePorDocente } from '@/prototipo/lib/revision';
import type { DocPaadResumen } from '@/prototipo/lib/informes';
import type { FiltrosPaac, FiltrosPaad } from '@/prototipo/types/navegacion';
import type { PaacDoc } from '@/prototipo/types/planificacion';
import { crearContexto, type EstructuraPrototipo } from '@/lib/prototipo-adapter';
import { registrarExpedienteAction, registrarResolucionAction } from '@/actions/planificacion.actions';
import { asignarDireccionPaad } from '@/actions/paad.actions';
import type { PaadResumenPrototipo } from '@/lib/prototipo-datos';

const isoDeLegible = (f: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(f) ? f.split('/').reverse().join('-') : f);

function useAviso() {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone; key: number } | null>(null);
  const avisar = (message: string, tone: ToastTone = 'success') => setToast({ message, tone, key: Date.now() });
  const nodo = toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />;
  return { avisar, nodo };
}

/** Filtros con los que se abre la bandeja (deep-link desde los dashboards). */
function filtrosPaac(p: URLSearchParams): FiltrosPaac | null {
  const f: FiltrosPaac = {
    careerId: p.get('careerId') ?? undefined,
    state: p.get('state') ?? p.get('estado') ?? undefined,
    regimen: p.get('regimen') ?? undefined,
    search: p.get('search') ?? undefined,
    ciclo: Number(p.get('ciclo')) || undefined,
    vista: (p.get('vista') as FiltrosPaac['vista']) ?? undefined,
  };
  return Object.values(f).some((v) => v !== undefined) ? f : null;
}

export function BandejaPlanificaciones(props: { paacs: PaacDoc[]; E: EstructuraPrototipo; docs: DocPaadResumen[]; role: string; uid: string; careerId: string }) {
  const params = useSearchParams();
  return <BandejaPaacInterna key={params.toString()} {...props} filtros={filtrosPaac(new URLSearchParams(params.toString()))} />;
}

function BandejaPaacInterna({
  paacs,
  E,
  docs,
  role,
  uid,
  careerId,
  filtros,
}: {
  paacs: PaacDoc[];
  E: EstructuraPrototipo;
  docs: DocPaadResumen[];
  role: string;
  uid: string;
  careerId: string;
  filtros: FiltrosPaac | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const { asigContext, fullName } = useMemo(() => crearContexto(E), [E]);
  const [protocoloId, setProtocoloId] = useState<string | null>(null);
  const { avisar, nodo } = useAviso();
  const puedeProtocolizar = role === 'CONSEJO_DEPARTAMENTAL' || role === 'ADMINISTRADOR';
  const docProtocolo = protocoloId ? paacs.find((d) => d.id === protocoloId) : undefined;

  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      try {
        const r = await fn();
        if (r && typeof r === 'object' && 'error' in r && typeof (r as { error?: unknown }).error === 'string') return avisar((r as { error: string }).error, 'warning');
        setProtocoloId(null);
        avisar(ok);
        router.refresh();
      } catch (e) {
        avisar(e instanceof Error ? e.message : 'No se pudo completar la acción.', 'warning');
      }
    });

  return (
    <>
      <PlanificacionesList
        paacs={paacs}
        role={role}
        uid={uid}
        careerId={careerId}
        cycle={E.ciclo}
        carreras={E.carreras}
        equiposCatedra={E.equipos}
        asigContext={asigContext}
        fullName={fullName}
        puedeEditar={(d) => role.startsWith('DOCENTE') && d.owner === uid && esEditablePorDocente(d)}
        onOpenDoc={(id) => router.push(`/planificaciones/${id}`)}
        onProtocolizar={puedeProtocolizar ? (id) => setProtocoloId(id) : undefined}
        onViewFinal={(id) => router.push(`/planificaciones/${id}`)}
        docs={docs}
        filtrosIniciales={filtros}
        onRestablecerFiltros={() => router.replace('/planificaciones')}
      />
      {docProtocolo && (
        <ProtocolizacionModal
          doc={docProtocolo}
          ctx={asigContext(docProtocolo.asignaturaId)}
          responsable={fullName(docProtocolo.owner)}
          onClose={() => setProtocoloId(null)}
          onRegistrarExpediente={(numeroExpediente, f) =>
            run(() => registrarExpedienteAction(docProtocolo.id, { numeroExpediente, fecha: isoDeLegible(f) }), 'Expediente caratulado: PAAC elevado al Consejo.')
          }
          onRegistrarResolucion={(numeroResolucion, f) =>
            run(() => registrarResolucionAction(docProtocolo.id, { numeroResolucion, fecha: isoDeLegible(f) }), 'Resolución registrada: planificación finalizada.')
          }
        />
      )}
      {nodo}
    </>
  );
}

export function BandejaPaads(props: { paads: PaadResumenPrototipo[]; E: EstructuraPrototipo; role: string }) {
  const params = useSearchParams();
  const f: FiltrosPaad = { careerId: params.get('careerId') ?? undefined, state: params.get('state') ?? params.get('estado') ?? undefined, search: params.get('search') ?? undefined };
  const filtros = Object.values(f).some((v) => v !== undefined) ? f : null;
  return <BandejaPaadsInterna key={params.toString()} {...props} filtros={filtros} />;
}

function BandejaPaadsInterna({ paads, E, role, filtros }: { paads: PaadResumenPrototipo[]; E: EstructuraPrototipo; role: string; filtros: FiltrosPaad | null }) {
  const router = useRouter();
  const [, start] = useTransition();
  const { asigContext, fullName } = useMemo(() => crearContexto(E), [E]);
  const { avisar, nodo } = useAviso();
  return (
    <>
      <PaadsListView
        paads={paads}
        role={role}
        carreras={E.carreras}
        equiposCatedra={E.equipos}
        cycle={E.ciclo}
        fullName={fullName}
        asigContext={asigContext}
        onOpenPaadDoc={(paadId, carreraId) => router.push(`/paads/${paadId}${carreraId ? `?carrera=${carreraId}` : ''}`)}
        onChangeEvalCareer={(paadId, carreraId) =>
          start(async () => {
            try {
              await asignarDireccionPaad(paadId, carreraId);
              avisar('Dirección evaluadora actualizada.');
              router.refresh();
            } catch (e) {
              avisar(e instanceof Error ? e.message : 'No se pudo cambiar la Dirección evaluadora.', 'warning');
            }
          })
        }
        filtrosIniciales={filtros}
        onRestablecerFiltros={() => router.replace('/paads')}
      />
      {nodo}
    </>
  );
}
