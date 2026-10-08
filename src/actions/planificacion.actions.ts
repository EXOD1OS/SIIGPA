'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PlanifStatus, UserRole } from '@prisma/client';
import { hasRole } from '@/lib/roles';
import { defaultPaad } from '@/lib/defaults';
import { planificacionVisiblePara } from '@/lib/visibilidad';
import { permiteObservaciones, tieneObservacionesPendientes } from '@/lib/observaciones';
import type {
  PaacData,
  PaadData,
  PedagogicalReportData,
  DisciplinaryReportData,
  GeneralReportData,
} from '@/types/planificacion';

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('No autenticado.');
  return session;
}

function revalidatePlanif(id: string) {
  revalidatePath(`/planificaciones/${id}`);
  revalidatePath('/planificaciones');
}

async function requirePlanificacionVisible(planificacionId: string, session: Awaited<ReturnType<typeof requireSession>>) {
  const planif = await planificacionVisiblePara(session.user, planificacionId);
  if (!planif) throw new Error('No encontrada o no autorizada.');
  return planif;
}

function requireEstadoEditable(estado: string) {
  if (!['BORRADOR', 'OBSERVADO'].includes(estado)) throw new Error('No editable en el estado actual.');
}

function requireSinObservacionesPendientes(planif: { observaciones: readonly { resuelto: boolean }[] }, mensaje: string) {
  if (tieneObservacionesPendientes(planif.observaciones)) throw new Error(mensaje);
}

export async function actualizarPaac(planifId: string, datosPaac: PaacData) {
  const session = await requireSession();
  const planif = await requirePlanificacionVisible(planifId, session);

  const puedeEditar = planif.docenteResponsableId === session.user.id || session.user.rol === UserRole.ADMINISTRADOR;
  if (!puedeEditar) throw new Error('No autorizado.');
  requireEstadoEditable(planif.estado);

  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { datosPaac: datosPaac as any },
  });

  revalidatePlanif(planifId);
  return updated;
}

export async function guardarPaad(input: {
  planificacionId: string;
  docenteId: string;
  cargoEnCatedra: string;
  datosPaad: PaadData;
}) {
  const session = await requireSession();
  const esPropio = session.user.id === input.docenteId && session.user.rol === UserRole.DOCENTE;
  const esAdmin = session.user.rol === UserRole.ADMINISTRADOR;
  if (!esPropio && !esAdmin) throw new Error('No autorizado.');

  const planif = await requirePlanificacionVisible(input.planificacionId, session);
  requireEstadoEditable(planif.estado);

  const paadExistente = await prisma.paadDocente.findUnique({
    where: { planificacionId_docenteId: { planificacionId: input.planificacionId, docenteId: input.docenteId } },
  });
  if (!paadExistente) throw new Error('El docente no pertenece al equipo de esta planificación.');

  const paad = await prisma.paadDocente.upsert({
    where: { planificacionId_docenteId: { planificacionId: input.planificacionId, docenteId: input.docenteId } },
    update: { cargoEnCatedra: input.cargoEnCatedra, datosPaad: input.datosPaad as any, estadoPresento: 'PRESENTO' },
    create: {
      planificacionId: input.planificacionId,
      docenteId: input.docenteId,
      cargoEnCatedra: input.cargoEnCatedra,
      datosPaad: input.datosPaad as any,
      estadoPresento: 'PRESENTO',
    },
  });

  revalidatePlanif(input.planificacionId);
  return paad;
}

export async function invitarDocenteEquipo(planificacionId: string, docenteId: string, cargoEnCatedra: string) {
  const session = await requireSession();
  const planif = await requirePlanificacionVisible(planificacionId, session);
  const autorizado = session.user.rol === UserRole.ADMINISTRADOR || planif.docenteResponsableId === session.user.id;
  if (!autorizado) throw new Error('No autorizado.');
  requireEstadoEditable(planif.estado);
  const docente = await prisma.usuario.findUnique({ where: { id: docenteId }, select: { rol: true } });
  if (!docente || docente.rol !== UserRole.DOCENTE) throw new Error('El integrante debe tener rol Docente.');

  const paad = await prisma.paadDocente.upsert({
    where: { planificacionId_docenteId: { planificacionId, docenteId } },
    update: { cargoEnCatedra },
    create: {
      planificacionId,
      docenteId,
      cargoEnCatedra,
      estadoPresento: 'NO_PRESENTO',
      datosPaad: defaultPaad() as any,
    },
  });

  revalidatePlanif(planificacionId);
  return paad;
}

export async function quitarDocenteEquipo(planificacionId: string, paadId: string) {
  const session = await requireSession();
  if (session.user.rol !== UserRole.ADMINISTRADOR) throw new Error('No autorizado.');

  const paad = await prisma.paadDocente.findUnique({ where: { id: paadId } });
  if (!paad || paad.planificacionId !== planificacionId) throw new Error('No encontrado.');

  const planif = await requirePlanificacionVisible(planificacionId, session);
  requireEstadoEditable(planif.estado);
  if (planif.docenteResponsableId === paad.docenteId) {
    throw new Error('No se puede quitar al Docente Responsable. Cambiá el responsable antes de quitarlo del equipo.');
  }

  await prisma.paadDocente.delete({ where: { id: paadId } });
  revalidatePlanif(planificacionId);
}

export async function cambiarResponsablePlanificacion(planificacionId: string, nuevoDocenteId: string, cargoEnCatedra: string) {
  const session = await requireSession();
  if (session.user.rol !== UserRole.ADMINISTRADOR) throw new Error('No autorizado.');

  const planif = await requirePlanificacionVisible(planificacionId, session);
  requireEstadoEditable(planif.estado);
  const nuevoResponsable = await prisma.usuario.findUnique({ where: { id: nuevoDocenteId }, select: { rol: true } });
  if (!nuevoResponsable || nuevoResponsable.rol !== UserRole.DOCENTE) throw new Error('El responsable debe tener rol Docente.');

  await prisma.$transaction([
    prisma.paadDocente.upsert({
      where: { planificacionId_docenteId: { planificacionId, docenteId: nuevoDocenteId } },
      update: {},
      create: {
        planificacionId,
        docenteId: nuevoDocenteId,
        cargoEnCatedra,
        estadoPresento: 'NO_PRESENTO',
        datosPaad: defaultPaad() as any,
      },
    }),
    prisma.planificacion.update({ where: { id: planificacionId }, data: { docenteResponsableId: nuevoDocenteId } }),
  ]);

  revalidatePlanif(planificacionId);
}

export async function enviarARevision(planifId: string) {
  const session = await requireSession();
  const planif = await requirePlanificacionVisible(planifId, session);

  const autorizado = session.user.rol === UserRole.ADMINISTRADOR || planif.docenteResponsableId === session.user.id;
  if (!autorizado) throw new Error('No autorizado.');
  if (!['BORRADOR', 'OBSERVADO'].includes(planif.estado)) throw new Error('El estado actual no permite el envío.');

  const equipoCompleto = planif.paads.length > 0 && planif.paads.every((p) => p.estadoPresento === 'PRESENTO');
  if (!equipoCompleto) throw new Error('El equipo docente no completó todos los PAAD.');
  requireSinObservacionesPendientes(
    planif,
    'No se puede enviar a revisión: primero deben resolverse todas las observaciones pendientes.',
  );

  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { estado: 'ENVIADO_A_REVISION' },
  });

  revalidatePlanif(planifId);
  return updated;
}

export async function agregarObservacion(input: {
  planificacionId: string;
  documentoTipo: 'PAAC' | 'PAAD';
  campoPath: string;
  mensaje: string;
  docentePaadId?: string;
}) {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.UAP, UserRole.DIRECCION_CARRERA, UserRole.ADMINISTRADOR])) {
    throw new Error('No autorizado.');
  }

  const planif = await requirePlanificacionVisible(input.planificacionId, session);
  if (!permiteObservaciones(planif.estado)) {
    throw new Error('Solo se pueden observar planificaciones enviadas a revisión o en evaluación.');
  }
  if (input.documentoTipo === 'PAAD' && input.docentePaadId && !planif.paads.some((p) => p.id === input.docentePaadId)) {
    throw new Error('El docente no pertenece al equipo de esta planificación.');
  }

  const observacion = await prisma.itemObservacion.create({
    data: {
      planificacionId: input.planificacionId,
      documentoTipo: input.documentoTipo,
      campoPath: input.campoPath,
      docentePaadId: input.docentePaadId,
      mensaje: input.mensaje,
      autorId: session.user.id,
      rolAutor: session.user.rol,
    },
  });

  revalidatePlanif(input.planificacionId);
  return observacion;
}

export async function resolverObservacion(observacionId: string) {
  const session = await requireSession();
  const obs = await prisma.itemObservacion.findUnique({ where: { id: observacionId } });
  if (!obs) throw new Error('No encontrada.');
  const planif = await requirePlanificacionVisible(obs.planificacionId, session);
  if (planif.estado !== 'OBSERVADO') throw new Error('Solo se pueden resolver observaciones de planificaciones observadas.');
  if (planif.docenteResponsableId !== session.user.id && session.user.rol !== UserRole.ADMINISTRADOR) {
    throw new Error('No autorizado.');
  }

  const updated = await prisma.itemObservacion.update({
    where: { id: observacionId },
    data: { resuelto: true },
  });

  revalidatePlanif(obs.planificacionId);
  return updated;
}

export async function marcarComoObservado(planifId: string) {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.UAP, UserRole.DIRECCION_CARRERA])) throw new Error('No autorizado.');

  const planif = await requirePlanificacionVisible(planifId, session);
  if (!['ENVIADO_A_REVISION', 'APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR'].includes(planif.estado)) {
    throw new Error('El estado actual no permite observar esta planificación.');
  }

  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { estado: 'OBSERVADO' },
  });

  revalidatePlanif(planifId);
  return updated;
}

export async function registrarAprobacionPedagogica(planifId: string, dictamen: PedagogicalReportData) {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.UAP, UserRole.ADMINISTRADOR])) throw new Error('No autorizado.');

  const planif = await requirePlanificacionVisible(planifId, session);
  if (!['ENVIADO_A_REVISION', 'APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR'].includes(planif.estado)) {
    throw new Error('El estado actual no permite registrar el dictamen pedagógico.');
  }

  if (dictamen.dictamen === 'REQUIERE_CORRECCION') {
    const updated = await prisma.planificacion.update({
      where: { id: planifId },
      data: { informePedagogico: dictamen as any, estado: 'OBSERVADO' },
    });
    revalidatePlanif(planifId);
    return updated;
  }

  requireSinObservacionesPendientes(
    planif,
    'No se puede registrar un dictamen favorable mientras existan observaciones pendientes.',
  );

  const nuevoEstado: PlanifStatus = planif.estado === 'APROBADO_DISCIPLINAR' ? 'APROBADO_PLENO' : 'APROBADO_PEDAGOGICO';
  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { informePedagogico: dictamen as any, estado: nuevoEstado },
  });

  revalidatePlanif(planifId);
  return updated;
}

export async function registrarAprobacionDisciplinar(planifId: string, dictamen: DisciplinaryReportData) {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.DIRECCION_CARRERA, UserRole.ADMINISTRADOR])) throw new Error('No autorizado.');

  const planif = await requirePlanificacionVisible(planifId, session);
  if (!['ENVIADO_A_REVISION', 'APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR'].includes(planif.estado)) {
    throw new Error('El estado actual no permite registrar el dictamen disciplinar.');
  }

  if (dictamen.dictamen === 'REQUIERE_CORRECCION') {
    const updated = await prisma.planificacion.update({
      where: { id: planifId },
      data: { informeDisciplinar: dictamen as any, estado: 'OBSERVADO' },
    });
    revalidatePlanif(planifId);
    return updated;
  }

  requireSinObservacionesPendientes(
    planif,
    'No se puede registrar un dictamen favorable mientras existan observaciones pendientes.',
  );

  const nuevoEstado: PlanifStatus = planif.estado === 'APROBADO_PEDAGOGICO' ? 'APROBADO_PLENO' : 'APROBADO_DISCIPLINAR';
  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { informeDisciplinar: dictamen as any, estado: nuevoEstado },
  });

  revalidatePlanif(planifId);
  return updated;
}

export async function guardarInformeGeneral(planifId: string, informe: GeneralReportData) {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.UAP, UserRole.DIRECCION_CARRERA, UserRole.ADMINISTRADOR])) {
    throw new Error('No autorizado.');
  }

  const planif = await requirePlanificacionVisible(planifId, session);
  if (planif.estado !== 'APROBADO_PLENO') throw new Error('El informe general solo puede elaborarse con aprobación plena.');

  const informeConAutoria: GeneralReportData = {
    ...informe,
    elaboradoPorUap: informe.elaboradoPorUap || session.user.rol === UserRole.UAP,
    elaboradoPorDireccion: informe.elaboradoPorDireccion || session.user.rol === UserRole.DIRECCION_CARRERA,
  };

  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { informeGeneral: informeConAutoria as any },
  });

  revalidatePlanif(planifId);
  return updated;
}

export async function elevarAlConsejo(planifId: string) {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.DIRECCION_CARRERA, UserRole.ADMINISTRADOR])) throw new Error('No autorizado.');

  const planif = await requirePlanificacionVisible(planifId, session);
  if (planif.estado !== 'APROBADO_PLENO') throw new Error('La planificación debe estar Aprobada Plena para elevarla.');
  requireSinObservacionesPendientes(planif, 'No se puede elevar una planificación con observaciones pendientes.');
  if (!planif.informeGeneral) throw new Error('Falta elaborar el Informe General de PAAC junto a la UAP.');
  const informeGeneral = planif.informeGeneral as unknown as GeneralReportData;
  if (!informeGeneral.elaboradoPorUap || !informeGeneral.elaboradoPorDireccion) {
    throw new Error('El Informe General debe contar con la participación de UAP y Dirección de Carrera.');
  }

  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { estado: 'ELEVADO_AL_CONSEJO' },
  });

  revalidatePlanif(planifId);
  return updated;
}

export async function asignarExpediente(planifId: string, nroExpediente: string) {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.CONSEJO_DEPARTAMENTAL, UserRole.ADMINISTRADOR])) throw new Error('No autorizado.');

  const planif = await requirePlanificacionVisible(planifId, session);
  if (planif.estado !== 'ELEVADO_AL_CONSEJO') throw new Error('La planificación debe estar elevada al consejo.');
  if (!nroExpediente.trim()) throw new Error('El número de expediente es obligatorio.');
  if (planif.numeroExpediente) throw new Error('Ya hay un expediente asignado.');

  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { numeroExpediente: nroExpediente },
  });

  revalidatePlanif(planifId);
  return updated;
}

export async function formalizarResolucion(planifId: string, nroResolucion: string) {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.CONSEJO_DEPARTAMENTAL, UserRole.ADMINISTRADOR])) throw new Error('No autorizado.');

  const planif = await requirePlanificacionVisible(planifId, session);
  if (planif.estado !== 'ELEVADO_AL_CONSEJO') throw new Error('La planificación debe estar elevada al consejo.');
  if (!planif.numeroExpediente) throw new Error('Primero hay que asignar el número de expediente.');
  if (!nroResolucion.trim()) throw new Error('El número de resolución es obligatorio.');
  if (planif.numeroResolucion) throw new Error('Ya hay una resolución asignada.');

  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: {
      numeroResolucion: nroResolucion,
      fechaAprobacionCd: new Date(),
      estado: 'FINALIZADO',
    },
  });

  revalidatePlanif(planifId);
  return updated;
}
