import Link from 'next/link';
import { PAAD_LABELS } from '@/lib/paad';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { planificacionVisiblePara } from '@/lib/visibilidad';
import { hasRole } from '@/lib/roles';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusTimeline } from '@/components/StatusTimeline';
import { ViewToggle } from '@/components/ViewToggle';
import { PaacForm } from '@/components/forms/PaacForm';
import { PaacDocumentView } from '@/components/documents/PaacDocumentView';
import { InvitarDocenteForm } from '@/components/forms/InvitarDocenteForm';
import { GestionEquipoModal } from '@/components/admin/GestionEquipoModal';
import { AccionesPanel } from '@/components/forms/AccionesPanel';
import { ArchivoExpedientePanel } from '@/components/forms/ArchivoExpedientePanel';
import { PlanificacionTabs, type TabDef } from '@/components/PlanificacionTabs';
import { SectionCard } from '@/components/forms/fields';
import { ObservationFieldWrapper } from '@/components/ObservationFieldWrapper';
import { VisorInformes } from '@/components/informes/VisorInformes';
import { EvaluacionInforme } from '@/components/informes/EvaluacionInforme';
import { permiteObservaciones } from '@/lib/observaciones';
import { construirContextoInformes, equipoConPaad } from '@/lib/informes-servidor';
import { observacionSugerida, sugerirInformeDisciplinar, sugerirInformePedagogico } from '@/lib/informes';

const ROL_OBS: Record<string, string> = { UAP: 'UAP', DIRECCION_CARRERA: 'Dirección', ADMINISTRADOR: 'Administración' };

export default async function PlanificacionDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const planif = await planificacionVisiblePara(session.user, params.id);
  if (!planif) notFound();

  const rol = session.user.rol;
  const esResponsable = planif.docenteResponsableId === session.user.id;
  const tieneObservacionesPendientes = planif.observaciones.some((observacion) => !observacion.resuelto);
  const estadoPermiteCorreccion =
    ['BORRADOR', 'OBSERVADO'].includes(planif.estado) || (tieneObservacionesPendientes && permiteObservaciones(planif.estado));
  const editablePaac = estadoPermiteCorreccion && (esResponsable || rol === UserRole.ADMINISTRADOR);
  const canObserve = hasRole(rol, [UserRole.UAP, UserRole.DIRECCION_CARRERA]) && permiteObservaciones(planif.estado);
  const canResolveObs = (esResponsable || rol === UserRole.ADMINISTRADOR) && planif.estado === 'OBSERVADO';
  // UAP y Dirección eliminan sus propias observaciones mientras el PAAC no esté finalizado.
  // Elevada o finalizada: inmutable (ni edición, ni observaciones, ni informes).
  const inmutable = ['ELEVADO_AL_CONSEJO', 'FINALIZADO'].includes(planif.estado);
  const rolEliminacion = hasRole(rol, [UserRole.UAP, UserRole.DIRECCION_CARRERA, UserRole.ADMINISTRADOR]) && !inmutable ? rol : null;

  const docentesDisponibles =
    esResponsable || rol === UserRole.ADMINISTRADOR
      ? await prisma.usuario.findMany({
          where: { rol: UserRole.DOCENTE, NOT: { id: { in: planif.integrantes.map((p) => p.docenteId) } } },
          orderBy: { apellido: 'asc' },
        })
      : [];

  const pendientesPaac = planif.observaciones.filter((o) => o.documentoTipo === 'PAAC' && !o.resuelto).length;
  const [equipo, contexto] = await Promise.all([equipoConPaad(planif), construirContextoInformes(planif)]);

  // Emisión de informes: SOLO desde aquí y SOLO el informe del rol (UAP → Pedagógico, Dirección → Disciplinar).
  const evaluaUap = rol === UserRole.UAP && ['ENVIADO_A_REVISION', 'APROBADO_DISCIPLINAR'].includes(planif.estado);
  const evaluaDireccion = rol === UserRole.DIRECCION_CARRERA && ['ENVIADO_A_REVISION', 'APROBADO_PEDAGOGICO'].includes(planif.estado);
  const evaluacionComun = {
    planificacionId: planif.id,
    pendientes: pendientesPaac,
    encabezado: contexto.encabezado,
    equipo: contexto.equipo,
  };

  const tabs: TabDef[] = [
    {
      key: 'PAAC',
      label: 'PAAC',
      pendientes: pendientesPaac,
      content: (
        <ViewToggle
          form={
            <PaacForm
              planificacionId={planif.id}
              data={planif.datosPaac as any}
              enfoque={planif.asignatura.planEstudio.enfoque}
              editable={editablePaac}
              canObserve={canObserve}
              canResolve={canResolveObs}
              rolEliminacion={rolEliminacion}
              observaciones={planif.observaciones.filter((o) => o.documentoTipo === 'PAAC')}
              infoGeneral={{
                sede: planif.asignatura.planEstudio.carrera.sede.nombre,
                carrera: planif.asignatura.planEstudio.carrera.nombre,
                planEstudio: planif.asignatura.planEstudio.ordenanza,
                asignatura: planif.asignatura.nombre,
                curso: `${planif.asignatura.anoCursada}° año`,
                regimen: planif.asignatura.regimen,
                creditoHorario: planif.asignatura.creditoHorario,
                contenidosMinimos: planif.asignatura.contenidosMinimosOficiales,
                equipoCatedra: equipo.map((p) => ({ cargo: p.cargo, nombre: p.nombre })),
              }}
            />
          }
          document={<PaacDocumentView data={planif.datosPaac} enfoque={planif.asignatura.planEstudio.enfoque} />}
        />
      ),
    },
    {
      key: 'EQUIPO',
      label: 'Equipo y PAAD',
      content: (
        <SectionCard title="Presentación del PAAD anual por docente">
          <p className="mb-4 text-sm text-muted">El PAAD es personal. Su presentación no bloquea el envío ni la aprobación de este PAAC.</p>
          {(esResponsable || rol === UserRole.ADMINISTRADOR) && ['BORRADOR', 'OBSERVADO'].includes(planif.estado) && (
            <InvitarDocenteForm planificacionId={planif.id} docentes={docentesDisponibles} />
          )}
          <div className="mt-4 space-y-3">
            {equipo.map((p) => {
              const anual = planif.integrantes.find((i) => i.docenteId === p.docenteId);
              return (
                <div key={p.docenteId} className="rounded-lg border border-border p-3 text-sm">
                  <p className="text-ink">
                    {p.nombre} · {p.cargo}
                  </p>
                  <p className="text-muted">
                    {p.presento ? 'Presentó' : 'No presentó'} · {p.paadEstado ? PAAD_LABELS[p.paadEstado as keyof typeof PAAD_LABELS] : 'Sin PAAD habilitado'}
                  </p>
                  {p.paadEstado && anual && rol !== UserRole.CONSEJO_DEPARTAMENTAL && (
                    <PaadLink docenteId={p.docenteId} ciclo={planif.cicloLectivo} asignaturaId={planif.asignaturaId} />
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      ),
    },
    {
      key: 'INFORMES',
      label: 'Informes',
      content: (
        <SectionCard title="Informes del PAAC (Ord. HCS N° 219/2022)">
          <VisorInformes contexto={contexto} />
        </SectionCard>
      ),
    },
  ];

  return (
    <div className="max-w-5xl space-y-8 pb-16">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">{planif.asignatura.nombre}</h1>
          <StatusBadge estado={planif.estado} pendientes={pendientesPaac} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {planif.asignatura.planEstudio.carrera.nombre} &middot; Ciclo {planif.cicloLectivo} &middot; {planif.asignatura.planEstudio.ordenanza}
        </p>
        <p className="mt-1 text-xs text-muted">
          Responsable: {planif.docenteResponsable.nombre} {planif.docenteResponsable.apellido}
        </p>
      </div>

      <div className="no-print">
        <StatusTimeline
          estado={planif.estado}
          pedagogicoFavorable={contexto.pedApproved}
          disciplinarFavorable={contexto.discApproved}
          numeroExpediente={planif.numeroExpediente}
          numeroResolucion={planif.numeroResolucion}
        />
      </div>

      {rol === UserRole.ADMINISTRADOR && (
        <div className="no-print flex justify-end">
          <GestionEquipoModal
            planificacionId={planif.id}
            docenteResponsableId={planif.docenteResponsableId}
            equipo={planif.integrantes.map((p) => ({
              paadId: p.id,
              docenteId: p.docenteId,
              nombre: `${p.docente.nombre} ${p.docente.apellido}`,
              cargo: p.cargoEnCatedra,
            }))}
            docentesDisponibles={docentesDisponibles.map((d) => ({ id: d.id, nombre: `${d.nombre} ${d.apellido}` }))}
          />
        </div>
      )}

      {evaluaUap && (
        <EvaluacionInforme
          {...evaluacionComun}
          area="uap"
          sugerido={sugerirInformePedagogico(planif.datosPaac)}
          obsSugerida={observacionSugerida('uap', pendientesPaac)}
        />
      )}
      {evaluaDireccion && (
        <EvaluacionInforme
          {...evaluacionComun}
          area="direccion"
          sugerido={sugerirInformeDisciplinar(planif.datosPaac, equipo)}
          obsSugerida={observacionSugerida('direccion', pendientesPaac)}
        />
      )}

      <div className="no-print">
        <AccionesPanel
          planificacionId={planif.id}
          estado={planif.estado}
          rol={rol}
          esResponsable={esResponsable}
          protocolo={{
            id: planif.id,
            estado: planif.estado,
            asignatura: planif.asignatura.nombre,
            detalle: [
              planif.asignatura.planEstudio.carrera.codigo,
              planif.asignatura.planEstudio.ordenanza,
              `Ciclo ${planif.cicloLectivo}`,
              `${planif.docenteResponsable.nombre} ${planif.docenteResponsable.apellido}`,
            ].join(' · '),
            expediente: planif.numeroExpediente,
            fechaElevacion: planif.fechaElevacion ? planif.fechaElevacion.toLocaleDateString('es-AR') : null,
            pedApproved: contexto.pedApproved,
            discApproved: contexto.discApproved,
          }}
        />
      </div>

      <ArchivoExpedientePanel
        planificacionId={planif.id}
        estado={planif.estado}
        puedeConsolidar={hasRole(rol, [UserRole.ADMINISTRADOR, UserRole.CONSEJO_DEPARTAMENTAL])}
      />

      <PlanificacionTabs tabs={tabs} />

      <section className="no-print">
        <SectionCard title="Historial de Observaciones">
          <div className="space-y-2">
            {planif.observaciones.map((o) =>
              o.resuelto ? (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="text-muted line-through">
                    <strong>[{ROL_OBS[o.rolAutor] ?? o.rolAutor}]</strong> {o.campoPath}: {o.mensaje}
                  </span>
                  <span className="text-xs text-success">Subsanada</span>
                </div>
              ) : (
                <ObservationFieldWrapper
                  key={o.id}
                  planificacionId={planif.id}
                  documentoTipo="PAAC"
                  fieldPath={o.campoPath}
                  observaciones={[o]}
                  canResolve={canResolveObs && !inmutable}
                  rolEliminacion={rolEliminacion}
                >
                  <p className="font-mono text-[11px] text-muted">{o.campoPath}</p>
                </ObservationFieldWrapper>
              ),
            )}
            {planif.observaciones.length === 0 && <p className="text-sm text-muted">Sin observaciones registradas.</p>}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

/** Enlace al PAAD anual del integrante con los Aspectos Generales proyectados sobre esta cátedra. */
async function PaadLink({ docenteId, ciclo, asignaturaId }: { docenteId: string; ciclo: number; asignaturaId: string }) {
  const paad = await prisma.paadAnual.findUnique({ where: { docenteId_cicloLectivo: { docenteId, cicloLectivo: ciclo } }, select: { id: true } });
  if (!paad) return null;
  return (
    <Link className="text-primary hover:underline" href={`/paads/${paad.id}?asignatura=${asignaturaId}`}>
      Ver PAAD anual
    </Link>
  );
}
