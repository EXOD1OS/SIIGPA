'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PlanifStatus, UserRole } from '@prisma/client';
import { hasRole } from '@/lib/roles';
import { asegurarPaad } from '@/lib/paad';
import { planificacionVisiblePara } from '@/lib/visibilidad';
import { permiteObservaciones, tieneObservacionesPendientes } from '@/lib/observaciones';
import { consolidarYSubirExpediente } from '@/lib/archivo-expediente';
import { dictamenesPaac } from '@/types/planificacion';
import { esPaacPrototipo } from '@/lib/prototipo-adapter';
import type { PaacContenido } from '@/prototipo/types/paac';
import type {
  InformeDisciplinarDatos,
  InformeDisciplinarGuardado,
  InformePedagogicoDatos,
  InformePedagogicoGuardado,
} from '@/types/informes';

/** Elevada o finalizada: nadie edita el PAAC, sus observaciones ni sus informes. */
const ESTADOS_INMUTABLES: string[] = ['ELEVADO_AL_CONSEJO', 'FINALIZADO'];

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('No autenticado.');
  return session;
}

function revalidatePlanif(id: string) {
  revalidatePath(`/planificaciones/${id}`);
  revalidatePath('/planificaciones');
  revalidatePath('/paads', 'layout');
  revalidatePath('/mi-paad');
  revalidatePath('/admin');
}

async function requirePlanificacionVisible(planificacionId: string, session: Awaited<ReturnType<typeof requireSession>>) {
  const planif = await planificacionVisiblePara(session.user, planificacionId);
  if (!planif) throw new Error('No encontrada o no autorizada.');
  return planif;
}

function requireEstadoEditable(estado: string, tienePendientes = false) {
  if (ESTADOS_INMUTABLES.includes(estado)) throw new Error('La planificación fue elevada al Consejo o finalizada: es de solo lectura.');
  if (!['BORRADOR', 'OBSERVADO'].includes(estado) && !(tienePendientes && permiteObservaciones(estado))) {
    throw new Error('No editable en el estado actual.');
  }
}

/** Prototipo (`finalizarRevision`): el favorable de un área se bloquea solo por SUS observaciones abiertas. */
function requirePendientesDelArea(planif: { observaciones: readonly { resuelto: boolean; rolAutor: string }[] }, rol: UserRole) {
  if (planif.observaciones.some((o) => !o.resuelto && o.rolAutor === rol)) {
    throw new Error('No se puede emitir un dictamen favorable mientras tengas observaciones sin subsanar.');
  }
}

function requireSinObservacionesPendientes(planif: { observaciones: readonly { resuelto: boolean }[] }, mensaje: string) {
  if (tieneObservacionesPendientes(planif.observaciones)) throw new Error(mensaje);
}

/**
 * Guarda el PAAC completo en el esquema del editor SIIGPA (PaacContenido): ningún campo ni tabla editable
 * del prototipo se pierde al recargar. Solo el Docente Responsable (o Administración) en Borrador u Observado.
 */
export async function actualizarPaac(planifId: string, datosPaac: PaacContenido) {
  const session = await requireSession();
  const planif = await requirePlanificacionVisible(planifId, session);

  const puedeEditar = planif.docenteResponsableId === session.user.id || session.user.rol === UserRole.ADMINISTRADOR;
  if (!puedeEditar) throw new Error('No autorizado.');
  requireEstadoEditable(planif.estado);
  if (!esPaacPrototipo(datosPaac)) throw new Error('El contenido del PAAC no tiene el formato esperado.');

  await prisma.planificacion.update({ where: { id: planifId }, data: { datosPaac: datosPaac as any } });
  revalidatePlanif(planifId);
}

export async function invitarDocenteEquipo(planificacionId: string, docenteId: string, cargoEnCatedra: string) {
  const session = await requireSession();
  const planif = await requirePlanificacionVisible(planificacionId, session);
  const autorizado = session.user.rol === UserRole.ADMINISTRADOR || planif.docenteResponsableId === session.user.id;
  if (!autorizado) throw new Error('No autorizado.');
  requireEstadoEditable(planif.estado);
  const docente = await prisma.usuario.findUnique({ where: { id: docenteId }, select: { rol: true } });
  if (!docente || docente.rol !== UserRole.DOCENTE) throw new Error('El integrante debe tener rol Docente.');

  const integrante = await prisma.$transaction(async tx => {
    const miembro = await tx.integrantePlanificacion.upsert({
      where: { planificacionId_docenteId: { planificacionId, docenteId } },
      update: { cargoEnCatedra }, create: { planificacionId, docenteId, cargoEnCatedra },
    });
    await tx.asignacionCatedra.upsert({
      where: { asignaturaId_cicloLectivo_docenteId: { asignaturaId: planif.asignaturaId, cicloLectivo: planif.cicloLectivo, docenteId } },
      create: { asignaturaId: planif.asignaturaId, cicloLectivo: planif.cicloLectivo, docenteId, categoria: cargoEnCatedra },
      update: { categoria: cargoEnCatedra },
    });
    await asegurarPaad(tx, docenteId, planif.cicloLectivo);
    return miembro;
  });
  revalidatePath('/paads', 'layout');
  revalidatePath('/admin');
  revalidatePlanif(planificacionId);
  return integrante;
}

export async function quitarDocenteEquipo(planificacionId: string, paadId: string) {
  const session = await requireSession();
  if (session.user.rol !== UserRole.ADMINISTRADOR) throw new Error('No autorizado.');

  const paad = await prisma.integrantePlanificacion.findUnique({ where: { id: paadId } });
  if (!paad || paad.planificacionId !== planificacionId) throw new Error('No encontrado.');

  const planif = await requirePlanificacionVisible(planificacionId, session);
  requireEstadoEditable(planif.estado);
  if (planif.docenteResponsableId === paad.docenteId) {
    throw new Error('No se puede quitar al Docente Responsable. Cambiá el responsable antes de quitarlo del equipo.');
  }

  await prisma.$transaction(async tx => {
    await tx.integrantePlanificacion.delete({ where: { id: paadId } });
    await tx.asignacionCatedra.deleteMany({ where: { asignaturaId: planif.asignaturaId, cicloLectivo: planif.cicloLectivo, docenteId: paad.docenteId } });
    await asegurarPaad(tx, paad.docenteId, planif.cicloLectivo);
  });
  revalidatePlanif(planificacionId);
}

export async function cambiarResponsablePlanificacion(planificacionId: string, nuevoDocenteId: string, cargoEnCatedra: string) {
  const session = await requireSession();
  if (session.user.rol !== UserRole.ADMINISTRADOR) throw new Error('No autorizado.');

  const planif = await requirePlanificacionVisible(planificacionId, session);
  requireEstadoEditable(planif.estado);
  const nuevoResponsable = await prisma.usuario.findUnique({ where: { id: nuevoDocenteId }, select: { rol: true } });
  if (!nuevoResponsable || nuevoResponsable.rol !== UserRole.DOCENTE) throw new Error('El responsable debe tener rol Docente.');

  await prisma.$transaction(async tx => {
    await tx.integrantePlanificacion.upsert({
      where: { planificacionId_docenteId: { planificacionId, docenteId: nuevoDocenteId } },
      update: { cargoEnCatedra }, create: { planificacionId, docenteId: nuevoDocenteId, cargoEnCatedra },
    });
    await tx.planificacion.update({ where: { id: planificacionId }, data: { docenteResponsableId: nuevoDocenteId } });
    await tx.asignacionCatedra.updateMany({
      where: { asignaturaId: planif.asignaturaId, cicloLectivo: planif.cicloLectivo }, data: { esResponsable: false },
    });
    await tx.asignacionCatedra.upsert({
      where: { asignaturaId_cicloLectivo_docenteId: { asignaturaId: planif.asignaturaId, cicloLectivo: planif.cicloLectivo, docenteId: nuevoDocenteId } },
      create: { asignaturaId: planif.asignaturaId, cicloLectivo: planif.cicloLectivo, docenteId: nuevoDocenteId, categoria: cargoEnCatedra, esResponsable: true },
      update: { categoria: cargoEnCatedra, esResponsable: true },
    });
    await asegurarPaad(tx, nuevoDocenteId, planif.cicloLectivo);
  });
  revalidatePath('/paads', 'layout');
  revalidatePath('/admin');
  revalidatePlanif(planificacionId);
}

export async function enviarARevision(planifId: string) {
  const session = await requireSession();
  const planif = await requirePlanificacionVisible(planifId, session);

  const autorizado = session.user.rol === UserRole.ADMINISTRADOR || planif.docenteResponsableId === session.user.id;
  if (!autorizado) throw new Error('No autorizado.');
  if (!['BORRADOR', 'OBSERVADO'].includes(planif.estado)) throw new Error('El estado actual no permite el envío.');

  requireSinObservacionesPendientes(
    planif,
    'No se puede enviar a revisión: primero deben resolverse todas las observaciones pendientes.',
  );

  // Presentación (prototipo `presentarDocumento`): los dictámenes observados vuelven a "En revisión"
  // y los favorables se conservan, por lo que el estado se recalcula a partir de ellos.
  const { pedApproved, discApproved } = dictamenesPaac(planif);
  const reevaluar = (inf: unknown) =>
    inf && typeof inf === 'object' && (inf as { dictamen?: string }).dictamen === 'REQUIERE_CORRECCION' ? { ...(inf as object), dictamen: 'REEVALUACION' } : undefined;
  const ped = reevaluar(planif.informePedagogico);
  const disc = reevaluar(planif.informeDisciplinar);
  const estado: PlanifStatus = pedApproved && discApproved ? 'APROBADO_PLENO' : pedApproved ? 'APROBADO_PEDAGOGICO' : discApproved ? 'APROBADO_DISCIPLINAR' : 'ENVIADO_A_REVISION';

  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { estado, ...(ped ? { informePedagogico: ped as any } : {}), ...(disc ? { informeDisciplinar: disc as any } : {}) },
  });

  revalidatePlanif(planifId);
  return updated;
}

/** Rol de revisión → área del prototipo. */
const areaDe = (rol: UserRole) => (rol === UserRole.UAP ? 'uap' : rol === UserRole.DIRECCION_CARRERA ? 'direccion' : null);

/**
 * «Enviar con revisiones» (UAP o Dirección): cierra la revisión del área con observaciones y devuelve el PAAC
 * al docente (estado OBSERVADO). Requiere observaciones ancladas del área o una observación escrita.
 */
export async function observarPaacAction(planifId: string, observaciones: string) {
  const session = await requireSession();
  const area = areaDe(session.user.rol);
  if (!area) throw new Error('No autorizado.');
  const planif = await requirePlanificacionVisible(planifId, session);
  if (!ESTADOS_EN_EVALUACION.includes(planif.estado)) throw new Error('El estado actual no permite observar esta planificación.');
  const { pedApproved, discApproved } = dictamenesPaac(planif);
  if ((area === 'uap' && pedApproved) || (area === 'direccion' && discApproved)) throw new Error('Tu área ya emitió dictamen favorable.');
  const pendientes = planif.observaciones.filter((o) => !o.resuelto && o.rolAutor === session.user.rol).length;
  if (pendientes === 0 && !observaciones.trim()) throw new Error('Anclá al menos una observación o escribí el motivo antes de devolver el PAAC.');

  const informe = { modelo: 'ORD_219_2022', dictamen: 'REQUIERE_CORRECCION', observaciones: observaciones.trim(), firmante: session.user.name ?? '', fecha: fechaInforme() };
  await prisma.planificacion.update({
    where: { id: planifId },
    data: { estado: 'OBSERVADO', ...(area === 'uap' ? { informePedagogico: informe } : { informeDisciplinar: informe }) },
  });
  revalidatePlanif(planifId);
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
  if (input.documentoTipo !== 'PAAC') throw new Error('Observá el PAAD desde su documento anual.');

  const observacion = await prisma.$transaction(async (tx) => {
    const creada = await tx.itemObservacion.create({
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

    // Flujo del prototipo: las observaciones ancladas se acumulan durante la revisión; el PAAC vuelve al
    // docente recién con «Enviar con revisiones» (observarPaacAction).
    return creada;
  });

  revalidatePlanif(input.planificacionId);
  return observacion;
}

export async function resolverObservacion(observacionId: string) {
  const session = await requireSession();
  const obs = await prisma.itemObservacion.findUnique({ where: { id: observacionId } });
  if (!obs) throw new Error('No encontrada.');
  if (obs.documentoTipo !== 'PAAC') throw new Error('El PAAD antiguo es un antecedente de solo lectura.');
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

const ESTADOS_EN_EVALUACION = ['ENVIADO_A_REVISION', 'APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR'];
const fechaInforme = () => new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Emisión del Informe Pedagógico (Anexo III, Ord. 219/22). Solo la UAP y solo desde adentro del PAAC:
 * guarda el JSON estructurado y registra el dictamen favorable del área.
 */
export async function registrarAprobacionPedagogica(planifId: string, input: { pedagogico: InformePedagogicoDatos; observaciones: string }) {
  const session = await requireSession();
  if (session.user.rol !== UserRole.UAP) throw new Error('Solo la UAP emite el Informe Pedagógico.');

  const planif = await requirePlanificacionVisible(planifId, session);
  if (!ESTADOS_EN_EVALUACION.includes(planif.estado) || planif.estado === 'APROBADO_PEDAGOGICO') {
    throw new Error('El estado actual no permite emitir el Informe Pedagógico.');
  }
  requirePendientesDelArea(planif, UserRole.UAP);

  const informe: InformePedagogicoGuardado = {
    modelo: 'ORD_219_2022',
    dictamen: 'FAVORABLE',
    pedagogico: input.pedagogico,
    observaciones: input.observaciones.trim(),
    firmante: session.user.name ?? 'UAP',
    fecha: fechaInforme(),
  };
  const nuevoEstado: PlanifStatus = planif.estado === 'APROBADO_DISCIPLINAR' ? 'APROBADO_PLENO' : 'APROBADO_PEDAGOGICO';
  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { informePedagogico: informe as any, estado: nuevoEstado },
  });

  revalidatePlanif(planifId);
  return updated;
}

/**
 * Emisión del Informe Disciplinar (Anexo IV, Ord. 219/22). Solo la Dirección de Carrera evaluadora
 * (la visibilidad ya restringe a su carrera) y solo desde adentro del PAAC.
 */
export async function registrarAprobacionDisciplinar(planifId: string, input: { disciplinar: InformeDisciplinarDatos; observaciones: string }) {
  const session = await requireSession();
  if (session.user.rol !== UserRole.DIRECCION_CARRERA) throw new Error('Solo la Dirección de Carrera emite el Informe Disciplinar.');

  const planif = await requirePlanificacionVisible(planifId, session);
  if (!ESTADOS_EN_EVALUACION.includes(planif.estado) || planif.estado === 'APROBADO_DISCIPLINAR') {
    throw new Error('El estado actual no permite emitir el Informe Disciplinar.');
  }
  requirePendientesDelArea(planif, UserRole.DIRECCION_CARRERA);

  const informe: InformeDisciplinarGuardado = {
    modelo: 'ORD_219_2022',
    dictamen: 'CUMPLE',
    disciplinar: input.disciplinar,
    observaciones: input.observaciones.trim(),
    firmante: session.user.name ?? 'Dirección de Carrera',
    fecha: fechaInforme(),
  };
  const nuevoEstado: PlanifStatus = planif.estado === 'APROBADO_PEDAGOGICO' ? 'APROBADO_PLENO' : 'APROBADO_DISCIPLINAR';
  const updated = await prisma.planificacion.update({
    where: { id: planifId },
    data: { informeDisciplinar: informe as any, estado: nuevoEstado },
  });

  revalidatePlanif(planifId);
  return updated;
}

/**
 * UAP y Dirección eliminan solo las observaciones de su área (el Administrador, cualquiera),
 * siempre que el PAAC no esté FINALIZADO.
 */
export async function eliminarObservacionAction(observacionId: string) {
  const session = await requireSession();
  const rol = session.user.rol;
  if (!hasRole(rol, [UserRole.UAP, UserRole.DIRECCION_CARRERA, UserRole.ADMINISTRADOR])) throw new Error('No autorizado.');

  const obs = await prisma.itemObservacion.findUnique({ where: { id: observacionId } });
  if (!obs) throw new Error('Observación no encontrada.');
  if (rol !== UserRole.ADMINISTRADOR && obs.rolAutor !== rol) throw new Error('Solo podés eliminar observaciones de tu área.');

  const planif = await requirePlanificacionVisible(obs.planificacionId, session);
  if (ESTADOS_INMUTABLES.includes(planif.estado)) {
    throw new Error('La planificación fue elevada al Consejo o finalizada: sus observaciones no se pueden eliminar.');
  }

  await prisma.itemObservacion.delete({ where: { id: observacionId } });
  revalidatePlanif(obs.planificacionId);
}


/** Fecha `aaaa-mm-dd` del formulario (o vacía = hoy) → Date a mediodía local, sin corrimientos de zona. */
function fechaProtocolo(iso: string | undefined) {
  if (!iso) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('La fecha no tiene un formato válido.');
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error('La fecha no es válida.');
  return d;
}

/**
 * Protocolización · 1.ª instancia (Consejo Departamental): caratula el expediente de un PAAC con
 * aprobación plena y lo eleva al Consejo (APROBADO_PLENO → ELEVADO_AL_CONSEJO). La resolución queda en null.
 */
export async function registrarExpedienteAction(planifId: string, input: { numeroExpediente: string; fecha?: string }) {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.CONSEJO_DEPARTAMENTAL, UserRole.ADMINISTRADOR])) throw new Error('No autorizado.');
  const numero = input.numeroExpediente.trim();
  if (!numero) throw new Error('El número de expediente es obligatorio.');
  const fecha = fechaProtocolo(input.fecha);

  const planif = await requirePlanificacionVisible(planifId, session);
  if (planif.estado !== 'APROBADO_PLENO') throw new Error('Solo se caratula el expediente de una planificación evaluada favorablemente (Aprobado Pleno).');
  requireSinObservacionesPendientes(planif, 'No se puede elevar una planificación con observaciones pendientes.');

  // Compare-and-set sobre el estado: evita doble caratulación concurrente.
  const { count } = await prisma.planificacion.updateMany({
    where: { id: planifId, estado: 'APROBADO_PLENO', numeroExpediente: null },
    data: { numeroExpediente: numero, fechaElevacion: fecha, numeroResolucion: null, estado: 'ELEVADO_AL_CONSEJO' },
  });
  if (count === 0) throw new Error('La planificación cambió de estado. Actualizá la página.');

  revalidatePlanif(planifId);
  revalidatePath('/dashboard');
}

/**
 * Protocolización · 2.ª instancia: registra la Resolución del Consejo Superior, consolida el expediente
 * inmutable en S3/MinIO (si está configurado) y finaliza la planificación (ELEVADO_AL_CONSEJO → FINALIZADO).
 */
export async function registrarResolucionAction(planifId: string, input: { numeroResolucion: string; fecha?: string }): Promise<{ error?: string; archivados?: number }> {
  const session = await requireSession();
  if (!hasRole(session.user.rol, [UserRole.CONSEJO_DEPARTAMENTAL, UserRole.ADMINISTRADOR])) throw new Error('No autorizado.');
  const numero = input.numeroResolucion.trim();
  if (!numero) throw new Error('El número de resolución es obligatorio.');
  const fecha = fechaProtocolo(input.fecha);

  const planif = await requirePlanificacionVisible(planifId, session);
  if (planif.estado !== 'ELEVADO_AL_CONSEJO') throw new Error('La planificación debe estar elevada al Consejo.');
  if (!planif.numeroExpediente) throw new Error('Primero hay que registrar el número de expediente.');
  if (planif.numeroResolucion) throw new Error('Ya hay una resolución registrada.');

  let archivados = 0;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Planificacion" WHERE id = ${planifId} FOR UPDATE`;
      const actual = await tx.planificacion.findUniqueOrThrow({ where: { id: planifId } });
      if (actual.estado !== 'ELEVADO_AL_CONSEJO') throw new Error('La planificación ya no está elevada al Consejo.');
      if (!actual.numeroExpediente) throw new Error('Primero hay que registrar el número de expediente.');
      if (actual.numeroResolucion) throw new Error('Ya hay una resolución registrada.');

      archivados = (await consolidarYSubirExpediente(tx, planifId, actual.numeroExpediente, numero, fecha)).length;
      await tx.planificacion.update({
        where: { id: planifId },
        data: { numeroResolucion: numero, fechaAprobacionCd: fecha, estado: 'FINALIZADO' },
      });
    }, { maxWait: 10_000, timeout: 120_000 });
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (statusCode === 403) {
      return {
        error: 'El almacenamiento de expedientes rechazó la escritura (S3 403). Revisá que las credenciales tengan permiso s3:PutObject sobre el bucket y la ruta planificaciones/*.',
      };
    }
    throw error;
  }

  revalidatePlanif(planifId);
  revalidatePath('/dashboard');
  return { archivados };
}