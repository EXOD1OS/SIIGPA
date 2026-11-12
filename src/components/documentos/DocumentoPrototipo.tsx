'use client';

// Contenedor de los editores literales del prototipo (DocumentFormView → PaacEditor / PaadEditor).
// Solo conecta los callbacks del prototipo con las Server Actions de Prisma; la UI es la de `src/prototipo/`.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentFormView } from '@/prototipo/components/views/DocumentFormView';
import { ReportEvaluationView } from '@/prototipo/components/views/ReportEvaluationView';
import { PaadModal } from '@/prototipo/components/shared/PaadModal';
import { ProtocolizacionModal } from '@/prototipo/components/planificaciones/ProtocolizacionModal';
import { Toast, type ToastTone } from '@/prototipo/components/shared/Toast';
import { catedraInicial, catedrasDocente, getDynamicPaadHeader, type FuentePaad } from '@/prototipo/lib/paad';
import type { InfoRevision } from '@/prototipo/components/shared/PanelRevision';
import type { AreaRevision, ResultadoRevision } from '@/prototipo/lib/revision';
import type { DocPaadResumen } from '@/prototipo/lib/informes';
import type { DocumentoEditable, InformeEvaluacion, PaacDoc } from '@/prototipo/types/planificacion';
import type { PaacContenido } from '@/prototipo/types/paac';
import type { PaadContenido } from '@/prototipo/types/paad';
import { anclaObservacion, crearContexto, type EstructuraPrototipo } from '@/lib/prototipo-adapter';
import {
  actualizarPaac,
  agregarObservacion,
  eliminarObservacionAction as eliminarObsPaac,
  enviarARevision,
  observarPaacAction,
  registrarAprobacionDisciplinar,
  registrarAprobacionPedagogica,
  registrarExpedienteAction,
  registrarResolucionAction,
  resolverObservacion,
} from '@/actions/planificacion.actions';
import {
  dictaminarPaad,
  eliminarObservacionAction as eliminarObsPaad,
  guardarBorradorPaad,
  observarPaad,
  presentarPaad,
  resolverObservacionPaad,
} from '@/actions/paad.actions';
import type { PaadResumenPrototipo } from '@/lib/prototipo-datos';

interface Permisos {
  canEdit: boolean;
  canSubmit: boolean;
  canObserve: boolean;
  /** Área que cierra su revisión desde el documento (null = la sesión no revisa). */
  revisionArea: AreaRevision | null;
  /** PAAC: área de la sesión para consultar su informe (UAP / Dirección). */
  areaSesion?: AreaRevision | null;
  /** PAAC: Consejo / Administración cargan expediente y resolución. */
  protocolizar?: boolean;
}

type Props =
  | {
      tipo: 'PAAC';
      doc: PaacDoc;
      E: EstructuraPrototipo;
      docs: DocPaadResumen[];
      paads: PaadResumenPrototipo[];
      role: string;
      uid: string;
      permisos: Permisos;
    }
  | {
      tipo: 'PAAD';
      doc: DocumentoEditable;
      E: EstructuraPrototipo;
      role: string;
      uid: string;
      permisos: Permisos;
      presentacionId: string | null;
      /** Cátedra desde la que se consulta el PAAD (`?asignatura=`) o carrera preferida. */
      contexto?: { asignaturaId?: string | null; carreraId?: string | null };
    };

const ahora = () => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
/** "12/05/2026" (fecha legible del prototipo) → "2026-05-12". */
const isoDeLegible = (f: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(f) ? f.split('/').reverse().join('-') : f);

export function DocumentoPrototipo(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { asigContext, fullName, equipoDeAsig } = useMemo(() => crearContexto(props.E), [props.E]);
  const [paac, setPaac] = useState<PaacContenido | undefined>(props.tipo === 'PAAC' ? props.doc.paac : undefined);
  const [paad, setPaad] = useState<PaadContenido | undefined>(props.tipo === 'PAAD' ? props.doc.paad : undefined);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<string | undefined>(undefined);
  const [vista, setVista] = useState<'documento' | 'informe'>('documento');
  const [paadAbierto, setPaadAbierto] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone; key: number } | null>(null);

  const avisar = (message: string, tone: ToastTone = 'success') => setToast({ message, tone, key: Date.now() });
  const run = (fn: () => Promise<unknown>, ok?: string, despues?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        if (r && typeof r === 'object' && 'error' in r && typeof (r as { error?: unknown }).error === 'string') {
          avisar((r as { error: string }).error, 'warning');
          return;
        }
        despues?.();
        if (ok) avisar(ok);
        router.refresh();
      } catch (e) {
        avisar(e instanceof Error ? e.message : 'No se pudo completar la acción.', 'warning');
      }
    });

  const doc = props.doc;
  const d: DocumentoEditable = { ...doc, paac, paad, sinGuardar, guardadoEn };
  const S = {
    cycle: props.E.ciclo,
    docs: props.tipo === 'PAAC' ? props.paads.map((p) => ({ id: p.id, type: 'PAAD', owner: p.owner, state: p.state })) : [],
    equiposCatedra: props.E.equipos,
    usuarios: props.E.usuarios,
  };

  const guardar = () =>
    props.tipo === 'PAAC' ? actualizarPaac(doc.id, paac as PaacContenido) : guardarBorradorPaad(doc.id, paad as PaadContenido);

  const pendientesArea = (area: AreaRevision) => doc.comments.filter((o) => !o.resolved && o.area === area).length;

  const finalizar = (r: ResultadoRevision, datos?: Partial<InformeEvaluacion>) => {
    const area = props.permisos.revisionArea;
    if (!area) return false;
    if (props.tipo === 'PAAD') {
      if (!props.presentacionId) return false;
      run(
        () => dictaminarPaad({ paadId: doc.id, presentacionId: props.presentacionId as string, resultado: r === 'FAVORABLE' ? 'FAVORABLE' : 'REQUIERE_CORRECCION', mensaje: '' }),
        r === 'FAVORABLE' ? 'PAAD aprobado.' : 'PAAD devuelto al docente con observaciones.',
      );
      return true;
    }
    const obs = (area === 'uap' ? datos?.obsGenerales : datos?.obsDisciplinares) ?? '';
    if (r === 'OBSERVADO') {
      run(() => observarPaacAction(doc.id, obs), 'PAAC devuelto al docente con observaciones.', () => setVista('documento'));
      return true;
    }
    if (area === 'uap') {
      if (!datos?.pedagogico) return false;
      run(() => registrarAprobacionPedagogica(doc.id, { pedagogico: datos.pedagogico!, observaciones: obs }), 'Informe Pedagógico emitido.', () => setVista('documento'));
    } else {
      if (!datos?.disciplinar) return false;
      run(() => registrarAprobacionDisciplinar(doc.id, { disciplinar: datos.disciplinar!, observaciones: obs }), 'Informe Disciplinar emitido.', () => setVista('documento'));
    }
    return true;
  };

  const revision: InfoRevision | null = props.permisos.revisionArea
    ? {
        area: props.permisos.revisionArea,
        pendientes: pendientesArea(props.permisos.revisionArea),
        onFinalizar: finalizar,
        // PAAC: el favorable abre el informe oficial del área, autocompletado.
        onAbrirInforme: props.tipo === 'PAAC' ? () => setVista('informe') : undefined,
      }
    : null;

  if (props.tipo === 'PAAC' && vista === 'informe') {
    return (
      <>
        <ReportEvaluationView
          d={{ ...(doc as PaacDoc), paac }}
          asigContext={asigContext}
          equipo={equipoDeAsig(doc.asignaturaId as string)}
          docs={props.docs}
          fullName={fullName}
          revision={revision}
          areaSesion={props.permisos.areaSesion ?? null}
          onBackToDoc={() => setVista('documento')}
        />
        {toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />}
      </>
    );
  }

  const paadModal = props.tipo === 'PAAC' && paadAbierto ? props.paads.find((p) => p.id === paadAbierto) : undefined;
  const fuentePaad: FuentePaad = { ciclo: props.E.ciclo, usuarios: props.E.usuarios, equipos: props.E.equipos, asigContext };
  const catedrasModal = paadModal ? catedrasDocente(paadModal.owner, fuentePaad) : [];

  return (
    <div aria-busy={pending}>
      <DocumentFormView
        d={d}
        role={props.role}
        uid={props.uid}
        canEdit={props.permisos.canEdit}
        canSubmit={props.permisos.canSubmit}
        canObserve={props.permisos.canObserve}
        asigContext={asigContext}
        equipoDeAsig={equipoDeAsig}
        fullName={fullName}
        S={S}
        onBack={() => router.push(props.tipo === 'PAAC' ? '/planificaciones' : props.role.startsWith('DOCENTE') ? '/dashboard' : '/paads')}
        onUpdatePaad={(c) => {
          setPaad(c);
          setSinGuardar(true);
        }}
        onUpdatePaac={(c) => {
          setPaac(c);
          setSinGuardar(true);
        }}
        onSaveDraft={() =>
          run(guardar, 'Borrador guardado.', () => {
            setSinGuardar(false);
            setGuardadoEn(ahora());
          })
        }
        onSubmitDoc={() =>
          run(
            async () => {
              await guardar();
              await (props.tipo === 'PAAC' ? enviarARevision(doc.id) : presentarPaad(doc.id));
            },
            props.tipo === 'PAAC' ? 'PAAC presentado a revisión.' : 'PAAD presentado a revisión.',
            () => setSinGuardar(false),
          )
        }
        onAddObs={(_fKey, path, txt, sec) =>
          run(
            () =>
              props.tipo === 'PAAC'
                ? agregarObservacion({ planificacionId: doc.id, documentoTipo: 'PAAC', campoPath: anclaObservacion(path, sec), mensaje: txt })
                : observarPaad({ paadId: doc.id, presentacionId: props.presentacionId ?? '', campoPath: anclaObservacion(path, sec), mensaje: txt }),
            'Observación anclada al campo.',
          )
        }
        onResolveObs={(id) => run(() => (props.tipo === 'PAAC' ? resolverObservacion(id) : resolverObservacionPaad(id)), 'Observación marcada como subsanada.')}
        onDeleteObs={(id) => run(() => (props.tipo === 'PAAC' ? eliminarObsPaac(id) : eliminarObsPaad(id)), 'Observación eliminada.')}
        onOpenReport={() => setVista('informe')}
        onOpenPaadModal={(paadId) => setPaadAbierto(paadId)}
        paadContexto={props.tipo === 'PAAD' ? props.contexto : undefined}
        revision={revision}
        onCargarResolucion={props.tipo === 'PAAC' && props.permisos.protocolizar ? () => setProtocolo(true) : undefined}
      />

      {paadModal && props.tipo === 'PAAC' && (
        <PaadModal
          paad={paadModal}
          catedras={catedrasModal}
          catedraInicial={catedraInicial(catedrasModal, { asignaturaId: doc.asignaturaId })}
          aspectosDe={(asig) => getDynamicPaadHeader(paadModal.owner, asig, fuentePaad)}
          docenteName={fullName(paadModal.owner)}
          carreraEvalName={paadModal.carreraEvalNombre}
          onAbrirDetalle={() => router.push(`/paads/${paadModal.id}?asignatura=${doc.asignaturaId ?? ''}`)}
          onClose={() => setPaadAbierto(null)}
        />
      )}

      {protocolo && props.tipo === 'PAAC' && (
        <ProtocolizacionModal
          doc={props.doc}
          ctx={asigContext(doc.asignaturaId as string)}
          responsable={fullName(doc.owner)}
          onClose={() => setProtocolo(false)}
          onRegistrarExpediente={(numeroExpediente, f) =>
            run(() => registrarExpedienteAction(doc.id, { numeroExpediente, fecha: isoDeLegible(f) }), 'Expediente caratulado: PAAC elevado al Consejo.', () => setProtocolo(false))
          }
          onRegistrarResolucion={(numeroResolucion, f) =>
            run(() => registrarResolucionAction(doc.id, { numeroResolucion, fecha: isoDeLegible(f) }), 'Resolución registrada: planificación finalizada.', () => setProtocolo(false))
          }
        />
      )}

      {toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  );
}
