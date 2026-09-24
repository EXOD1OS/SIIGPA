'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PlanifStatus, UserRole } from '@prisma/client';
import { hasRole } from '@/lib/roles';
import { defaultPaad } from '@/lib/defaults';
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

export async function actualizarPaac(planifId: string, datosPaac: PaacData) {
  const session = await requireSession();
  const planif = await prisma.planificacion.findUnique({ where: { id: planifId } });
  if (!planif) throw new Error('No encontrada.');

  const puedeEditar = planif.docenteResponsableId === session.user.id || session.user.rol === UserRole.ADMINISTRADOR;
  if (!puedeEditar) throw new Error('No autorizado.');
  if (!['BORRADOR', 'OBSERVADO'].includes(planif.estado)) throw new Error('No editable en el estado actual.');

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
  const esPropio = session.user.id === input.docenteId;
  const esAdmin = session.user.rol === UserRole.ADMINISTRADOR;
  if (!esPropio && !esAdmin) throw new Error('No autorizado.');

  const planif = await prisma.planificacion.findUnique({ where: { id: input.planificacionId } });
  if (!planif) throw new Error('No encontrada.');
  if (!['BORRADOR', 'OBSERVADO'].includes(planif.estado)) throw new Error('No editable en el estado actual.');

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
  const planif = await prisma.planificacion.findUnique({ where: { id: planificacionId } });
  if (!planif) throw new Error('No encontrada.');
  const autorizado = session.user.rol === UserRole.ADMINISTRADOR || planif.docenteResponsableId === session.user.id;
  if (!autorizado) throw new Error('No autorizado.');

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

  const planif = await prisma.planificacion.findUnique({ where: { id: planificacionId } });
  if (!planif) throw new Error('No encontrada.');
  if (planif.docenteResponsableId === paad.docenteId) {
    throw new Error('No se puede quitar al Docente Responsable. Cambiá el responsable antes de quitarlo del equipo.');
  }

  await prisma.paadDocente.delete({ where: { id: paadId } });
  revalidatePlanif(planificacionId);
}

export async function cambiarResponsablePlanificacion(planificacionId: string, nuevoDocenteId: string, cargoEnCatedra: string) {
  const session = await requireSession();
  if (session.user.rol !== UserRole.ADMINISTRADOR) throw new Error('No autorizado.');

  const planif = await prisma.planificacion.findUnique({ where: { id: planificacionId } });
  if (!planif) throw new Error('No encontrada.');

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
  const planif = await prisma.planificacion.findUnique({ where: { id: planifId }, include: { paads: true } });
  if (!planif) throw new Error('No encontrada.');

  const autorizado = session.user.rol === UserRole.ADMINISTRADOR || planif.docenteResponsableId === session.user.id;
  if (!autorizado) throw new Error('No autorizado.');
  if (!['BORRADOR', 'OBSERVADO'].includes(planif.estado)) throw new Error('El estado actual no permite el envío.');

  const equipoCompleto = planif.paads.length > 0 && planif.paads.every((p) => p.estadoPresento === 'PRESENTO');
  if (!equipoCompleto) throw new Error('El equipo docente no completó todos los PAAD.');

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

  const planif = await prisma.planificacion.findUnique({ where: { id: planifId } });
  if (!planif) throw new Error('No encontrada.');

  if (dictamen.dictamen === 'REQUIERE_CORRECCION') {
    const updated = await prisma.planificacion.update({
      where: { id: planifId },
      data: { informePedagogico: dictamen as any, estado: 'OBSERVADO' },
    });
    revalidatePlanif(planifId);
    return updated;
  }

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

  const planif = await prisma.planificacion.findUnique({ where: { id: planifId } });
  if (!planif) throw new Error('No encontrada.');

  if (dictamen.dictamen === 'REQUIERE_CORRECCION') {
    const updated = await prisma.planificacion.update({
      where: { id: planifId },
      data: { informeDisciplinar: dictamen as any, estado: 'OBSERVADO' },
    });
    revalidatePlanif(planifId);
    return updated;
  }

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

  const planif = await prisma.planificacion.findUnique({ where: { id: planifId } });
  if (!planif) throw new Error('No encontrada.');
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

  const planif = await prisma.planificacion.findUnique({ where: { id: planifId } });
  if (!planif) throw new Error('No encontrada.');
  if (planif.estado !== 'APROBADO_PLENO') throw new Error('La planificación debe estar Aprobada Plena para elevarla.');
  if (!planif.informeGeneral) throw new Error('Falta elaborar el Informe General de PAAC junto a la UAP.');

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

  const planif = await prisma.planificacion.findUnique({ where: { id: planifId } });
  if (!planif) throw new Error('No encontrada.');
  if (planif.estado !== 'ELEVADO_AL_CONSEJO') throw new Error('La planificación debe estar elevada al consejo.');

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

  const planif = await prisma.planificacion.findUnique({ where: { id: planifId } });
  if (!planif) throw new Error('No encontrada.');
  if (planif.estado !== 'ELEVADO_AL_CONSEJO') throw new Error('La planificación debe estar elevada al consejo.');
  if (!planif.numeroExpediente) throw new Error('Primero hay que asignar el número de expediente.');

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
