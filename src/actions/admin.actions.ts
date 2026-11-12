'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { asegurarPaad } from '@/lib/paad';
import { generarPlanificacionesDelCiclo } from '@/lib/generar-planificaciones';
import { UserRole } from '@prisma/client';

const CATEGORIAS_DOCENTES = ['TITULAR', 'ASOCIADO', 'ADJUNTO', 'JTP', 'AYUDANTE'];

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.rol !== UserRole.ADMINISTRADOR) throw new Error('No autorizado.');
  return session;
}

// ============================================================================
// Usuarios
// ============================================================================

export async function crearUsuario(input: {
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  rol: UserRole;
  carreraId?: string | null;
  asignacionInicial?: {
    asignaturaId: string;
    cicloLectivo: number;
    categoria: string;
  };
}) {
  await requireAdmin();

  if (input.rol === UserRole.DIRECCION_CARRERA && !input.carreraId) {
    throw new Error('Debe seleccionar una carrera para el rol Dirección de Carrera.');
  }
  if (input.asignacionInicial) {
    if (input.rol !== UserRole.DOCENTE) throw new Error('Solo se pueden asignar materias a usuarios docentes.');
    if (!Number.isInteger(input.asignacionInicial.cicloLectivo) || input.asignacionInicial.cicloLectivo < 2000) {
      throw new Error('El ciclo lectivo debe ser un año válido.');
    }
    if (!CATEGORIAS_DOCENTES.includes(input.asignacionInicial.categoria)) {
      throw new Error('Debe seleccionar una categoría docente válida.');
    }
  }

  const passwordHash = await bcrypt.hash(input.dni, 10);

  const { usuario, planificacionId } = await prisma.$transaction(async (tx) => {
    const asignacion = input.asignacionInicial;
    let planificacionId: string | null = null;
    if (asignacion) {
      const asignatura = await tx.asignatura.findUnique({ where: { id: asignacion.asignaturaId }, select: { id: true } });
      if (!asignatura) throw new Error('La materia seleccionada no existe.');
      const planificacion = await tx.planificacion.findUnique({
        where: {
          asignaturaId_cicloLectivo: {
            asignaturaId: asignacion.asignaturaId,
            cicloLectivo: asignacion.cicloLectivo,
          },
        },
        select: { id: true, estado: true },
      });
      if (planificacion && !['BORRADOR', 'OBSERVADO'].includes(planificacion.estado)) {
        throw new Error('La planificación de esa materia ya fue enviada a revisión y no admite nuevos integrantes.');
      }
      planificacionId = planificacion?.id ?? null;
    }

    const creado = await tx.usuario.create({
      data: {
        nombre: input.nombre,
        apellido: input.apellido,
        email: input.email,
        dni: input.dni,
        rol: input.rol,
        carreraId: input.rol === UserRole.DIRECCION_CARRERA ? input.carreraId : null,
        passwordHash,
        mustChangePassword: true,
      },
    });

    if (asignacion) {
      await tx.asignacionCatedra.create({
        data: {
          asignaturaId: asignacion.asignaturaId,
          cicloLectivo: asignacion.cicloLectivo,
          docenteId: creado.id,
          categoria: asignacion.categoria,
        },
      });
      if (planificacionId) {
        await tx.integrantePlanificacion.create({
          data: {
            planificacionId,
            docenteId: creado.id,
            cargoEnCatedra: asignacion.categoria,
          },
        });
      }
    }

    if (creado.rol === UserRole.DOCENTE) await asegurarPaad(tx, creado.id, asignacion?.cicloLectivo ?? new Date().getFullYear());
    return { usuario: creado, planificacionId };
  });

  revalidatePath('/paads', 'layout');
  revalidatePath('/admin/usuarios');
  if (input.asignacionInicial) {
    revalidatePath('/admin');
    revalidatePath('/planificaciones');
    if (planificacionId) revalidatePath(`/planificaciones/${planificacionId}`);
  }
  // Solo el id: nunca devolver el registro completo (incluye el hash de la contraseña) al cliente.
  return { id: usuario.id };
}

export async function generarPlanificaciones(cicloLectivo: number) {
  await requireAdmin();
  const resultado = await generarPlanificacionesDelCiclo(prisma, cicloLectivo);
  revalidatePath('/paads', 'layout');
  revalidatePath('/mi-paad');
  revalidatePath('/admin');
  revalidatePath('/planificaciones');
  revalidatePath('/dashboard');
  return resultado;
}

// ============================================================================
// Equipo de Cátedra (roster independiente de la Planificacion)
// ============================================================================

async function planificacionEditableEquipo(tx: import('@prisma/client').Prisma.TransactionClient, asignaturaId: string, cicloLectivo: number) {
  const planificacion = await tx.planificacion.findUnique({ where: { asignaturaId_cicloLectivo: { asignaturaId, cicloLectivo } } });
  if (planificacion && !['BORRADOR', 'OBSERVADO'].includes(planificacion.estado)) {
    throw new Error('El equipo de una planificación en revisión o aprobada no puede modificarse.');
  }
  return planificacion;
}

export async function agregarIntegranteCatedra(input: { asignaturaId: string; cicloLectivo: number; docenteId: string; categoria: string }) {
  await requireAdmin();
  if (!CATEGORIAS_DOCENTES.includes(input.categoria)) throw new Error('Categoría inválida.');
  const asignacion = await prisma.$transaction(async tx => {
    const planificacion = await planificacionEditableEquipo(tx, input.asignaturaId, input.cicloLectivo);
    const creado = await tx.asignacionCatedra.upsert({
      where: { asignaturaId_cicloLectivo_docenteId: { asignaturaId: input.asignaturaId, cicloLectivo: input.cicloLectivo, docenteId: input.docenteId } },
      create: input, update: { categoria: input.categoria },
    });
    if (planificacion) await tx.integrantePlanificacion.upsert({
      where: { planificacionId_docenteId: { planificacionId: planificacion.id, docenteId: input.docenteId } },
      create: { planificacionId: planificacion.id, docenteId: input.docenteId, cargoEnCatedra: input.categoria },
      update: { cargoEnCatedra: input.categoria },
    });
    await asegurarPaad(tx, input.docenteId, input.cicloLectivo);
    return creado;
  });
  revalidatePath('/admin'); revalidatePath('/paads', 'layout'); revalidatePath('/planificaciones', 'layout');
  return asignacion;
}

export async function actualizarCategoriaIntegrante(asignacionId: string, categoria: string) {
  await requireAdmin();
  if (!CATEGORIAS_DOCENTES.includes(categoria)) throw new Error('Categoría inválida.');
  const asignacion = await prisma.$transaction(async tx => {
    const actual = await tx.asignacionCatedra.findUniqueOrThrow({ where: { id: asignacionId } });
    const planificacion = await planificacionEditableEquipo(tx, actual.asignaturaId, actual.cicloLectivo);
    if (planificacion) await tx.integrantePlanificacion.updateMany({
      where: { planificacionId: planificacion.id, docenteId: actual.docenteId }, data: { cargoEnCatedra: categoria },
    });
    return tx.asignacionCatedra.update({ where: { id: asignacionId }, data: { categoria } });
  });
  revalidatePath('/admin'); revalidatePath('/planificaciones', 'layout');
  return asignacion;
}

export async function desvincularIntegrante(asignacionId: string) {
  await requireAdmin();
  await prisma.$transaction(async tx => {
    const actual = await tx.asignacionCatedra.findUniqueOrThrow({ where: { id: asignacionId } });
    const planificacion = await planificacionEditableEquipo(tx, actual.asignaturaId, actual.cicloLectivo);
    if (actual.esResponsable || planificacion?.docenteResponsableId === actual.docenteId) throw new Error('Cambiá el responsable antes de quitarlo.');
    if (planificacion) await tx.integrantePlanificacion.deleteMany({ where: { planificacionId: planificacion.id, docenteId: actual.docenteId } });
    await tx.asignacionCatedra.delete({ where: { id: asignacionId } });
    await asegurarPaad(tx, actual.docenteId, actual.cicloLectivo);
  });
  revalidatePath('/admin'); revalidatePath('/paads', 'layout'); revalidatePath('/planificaciones', 'layout');
}

// ============================================================================
// Equipo de cátedra completo (EquipoCatedraModal) y cátedras de un usuario
// ============================================================================

export interface IntegranteEquipoInput {
  docenteId: string;
  categoria: string;
  esResponsable: boolean;
}

type Tx = import('@prisma/client').Prisma.TransactionClient;

/**
 * Reemplaza el equipo de una asignatura en un ciclo: altas, cambios de cargo, responsable y bajas.
 * Mantiene sincronizados el roster (`AsignacionCatedra`), el equipo de la planificación y los PAAD.
 */
async function aplicarEquipo(tx: Tx, asignaturaId: string, cicloLectivo: number, integrantes: IntegranteEquipoInput[]) {
  if (!Number.isInteger(cicloLectivo) || cicloLectivo < 2000 || cicloLectivo > 2100) throw new Error('Ciclo lectivo inválido.');
  if (integrantes.some((i) => !CATEGORIAS_DOCENTES.includes(i.categoria))) throw new Error('Categoría inválida.');
  if (new Set(integrantes.map((i) => i.docenteId)).size !== integrantes.length) throw new Error('Un docente figura dos veces en el equipo.');
  const responsables = integrantes.filter((i) => i.esResponsable);
  if (responsables.length > 1) throw new Error('Solo puede haber un Docente Responsable.');
  if (integrantes.length > 0 && responsables.length === 0) throw new Error('Designá un Docente Responsable antes de guardar.');
  if (integrantes.length) {
    const docentes = await tx.usuario.count({ where: { id: { in: integrantes.map((i) => i.docenteId) }, rol: UserRole.DOCENTE } });
    if (docentes !== integrantes.length) throw new Error('Todos los integrantes deben tener rol Docente.');
  }

  const planificacion = await planificacionEditableEquipo(tx, asignaturaId, cicloLectivo);
  if (planificacion && integrantes.length === 0) throw new Error('La planificación de este ciclo requiere al menos un Docente Responsable.');
  const actuales = await tx.asignacionCatedra.findMany({ where: { asignaturaId, cicloLectivo } });

  for (const i of integrantes) {
    await tx.asignacionCatedra.upsert({
      where: { asignaturaId_cicloLectivo_docenteId: { asignaturaId, cicloLectivo, docenteId: i.docenteId } },
      create: { asignaturaId, cicloLectivo, docenteId: i.docenteId, categoria: i.categoria, esResponsable: i.esResponsable },
      update: { categoria: i.categoria, esResponsable: i.esResponsable },
    });
    if (planificacion) {
      await tx.integrantePlanificacion.upsert({
        where: { planificacionId_docenteId: { planificacionId: planificacion.id, docenteId: i.docenteId } },
        create: { planificacionId: planificacion.id, docenteId: i.docenteId, cargoEnCatedra: i.categoria },
        update: { cargoEnCatedra: i.categoria },
      });
    }
  }
  const responsable = responsables[0];
  if (planificacion && responsable && planificacion.docenteResponsableId !== responsable.docenteId) {
    await tx.planificacion.update({ where: { id: planificacion.id }, data: { docenteResponsableId: responsable.docenteId } });
  }

  const quedan = new Set(integrantes.map((i) => i.docenteId));
  const quitados = actuales.filter((a) => !quedan.has(a.docenteId));
  for (const a of quitados) {
    if (planificacion) await tx.integrantePlanificacion.deleteMany({ where: { planificacionId: planificacion.id, docenteId: a.docenteId } });
    await tx.asignacionCatedra.delete({ where: { id: a.id } });
  }
  for (const docenteId of new Set([...quedan, ...quitados.map((a) => a.docenteId)])) {
    await asegurarPaad(tx, docenteId, cicloLectivo);
  }
  return planificacion?.id ?? null;
}

function revalidarEquipos(planificacionIds: (string | null)[] = []) {
  revalidatePath('/admin');
  revalidatePath('/admin/usuarios');
  revalidatePath('/paads', 'layout');
  revalidatePath('/planificaciones', 'layout');
  revalidatePath('/mi-paad');
  revalidatePath('/dashboard');
  planificacionIds.forEach((id) => id && revalidatePath(`/planificaciones/${id}`));
}

/** Guarda el equipo de cátedra completo de una asignatura en un ciclo (EquipoCatedraModal). */
export async function guardarEquipoCatedra(asignaturaId: string, cicloLectivo: number, integrantes: IntegranteEquipoInput[]) {
  await requireAdmin();
  const planificacionId = await prisma.$transaction((tx) => aplicarEquipo(tx, asignaturaId, cicloLectivo, integrantes), { timeout: 20000 });
  revalidarEquipos([planificacionId]);
}

/**
 * Cátedras de un docente en un ciclo (UsuarioFormModal): incorpora, cambia cargo o responsabilidad y
 * desvincula. Un responsable ya guardado no se quita desde aquí (se cambia desde Estructura Académica).
 */
export async function sincronizarCatedrasUsuario(usuarioId: string, cicloLectivo: number, catedras: { asignaturaId: string; categoria: string; esResponsable: boolean }[]) {
  await requireAdmin();
  const ids = await prisma.$transaction(
    async (tx) => {
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { rol: true } });
      if (usuario.rol !== UserRole.DOCENTE && catedras.length) throw new Error('Solo los docentes integran equipos de cátedra.');
      const propias = await tx.asignacionCatedra.findMany({ where: { docenteId: usuarioId, cicloLectivo } });
      const afectadas = new Set([...propias.map((p) => p.asignaturaId), ...catedras.map((c) => c.asignaturaId)]);
      const planificaciones: (string | null)[] = [];
      for (const asignaturaId of afectadas) {
        const antes = propias.find((p) => p.asignaturaId === asignaturaId);
        const despues = catedras.find((c) => c.asignaturaId === asignaturaId);
        if (antes && despues && antes.categoria === despues.categoria && antes.esResponsable === despues.esResponsable) continue;
        if (antes?.esResponsable && !despues?.esResponsable) {
          throw new Error('Es Docente Responsable de una cátedra: designá otro responsable desde Estructura Académica antes de quitarlo.');
        }
        const equipo = (await tx.asignacionCatedra.findMany({ where: { asignaturaId, cicloLectivo } }))
          .filter((a) => a.docenteId !== usuarioId)
          .map((a) => ({ docenteId: a.docenteId, categoria: a.categoria, esResponsable: despues?.esResponsable ? false : a.esResponsable }));
        if (despues) equipo.push({ docenteId: usuarioId, categoria: despues.categoria, esResponsable: despues.esResponsable });
        planificaciones.push(await aplicarEquipo(tx, asignaturaId, cicloLectivo, equipo));
      }
      return planificaciones;
    },
    { timeout: 30000 },
  );
  revalidarEquipos(ids);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DNI_RE = /^\d{7,8}$/;

/** Edición de datos personales y rol. Un docente con cátedras no cambia de rol sin desvincularlas antes. */
export async function actualizarUsuario(
  id: string,
  input: { nombre: string; apellido: string; email: string; dni: string; rol: UserRole; carreraId?: string | null },
) {
  const session = await requireAdmin();
  const email = input.email.trim().toLowerCase();
  const dni = input.dni.trim();
  if (!input.nombre.trim() || !input.apellido.trim()) throw new Error('Nombre y apellido son obligatorios.');
  if (!EMAIL_RE.test(email)) throw new Error('El email no tiene un formato válido.');
  if (!DNI_RE.test(dni)) throw new Error('El DNI debe tener 7 u 8 dígitos, sin puntos.');
  if (input.rol === UserRole.DIRECCION_CARRERA && !input.carreraId) throw new Error('Seleccioná la carrera que dirige.');

  const actual = await prisma.usuario.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { asignacionesCatedra: true, equiposPlanificacion: true, planifResponsable: true } } },
  });
  if (actual.rol === UserRole.DOCENTE && input.rol !== UserRole.DOCENTE) {
    const { asignacionesCatedra, equiposPlanificacion, planifResponsable } = actual._count;
    if (asignacionesCatedra + equiposPlanificacion + planifResponsable > 0) {
      throw new Error('El docente integra equipos de cátedra: desvinculalo de sus cátedras antes de cambiar su rol.');
    }
  }
  if (actual.rol === UserRole.ADMINISTRADOR && input.rol !== UserRole.ADMINISTRADOR) {
    if (id === session.user.id) throw new Error('No podés quitarte el rol de Administrador a vos mismo.');
    if ((await prisma.usuario.count({ where: { rol: UserRole.ADMINISTRADOR } })) <= 1) throw new Error('Es el único administrador del sistema.');
  }
  const duplicado = await prisma.usuario.findFirst({ where: { id: { not: id }, OR: [{ email }, { dni }] }, select: { email: true } });
  if (duplicado) throw new Error(duplicado.email === email ? 'Ya existe un usuario con ese email.' : 'Ya existe un usuario con ese DNI.');

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id },
      data: {
        nombre: input.nombre.trim(),
        apellido: input.apellido.trim(),
        email,
        dni,
        rol: input.rol,
        carreraId: input.rol === UserRole.DIRECCION_CARRERA ? input.carreraId : null,
      },
    });
    if (input.rol === UserRole.DOCENTE && actual.rol !== UserRole.DOCENTE) await asegurarPaad(tx, id, new Date().getFullYear());
  });
  revalidatePath('/admin/usuarios');
  revalidatePath('/admin');
}

/** Blanquea la contraseña al DNI y obliga a cambiarla en el próximo ingreso. */
export async function blanquearClaveDni(id: string) {
  await requireAdmin();
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id }, select: { dni: true } });
  await prisma.usuario.update({ where: { id }, data: { passwordHash: await bcrypt.hash(usuario.dni, 10), mustChangePassword: true } });
  revalidatePath('/admin/usuarios');
}

/**
 * Baja de un usuario sin trazabilidad académica. Se bloquea si dejaría la estructura inconsistente o si
 * borraría historial (responsable de cátedras, autor de observaciones/dictámenes, PAAD presentados…).
 */
export async function eliminarUsuario(id: string) {
  const session = await requireAdmin();
  if (id === session.user.id) throw new Error('No podés eliminar tu propia cuenta.');
  const u = await prisma.usuario.findUniqueOrThrow({
    where: { id },
    include: {
      _count: {
        select: { planifResponsable: true, observaciones: true, observacionesPaad: true, dictamenesPaad: true, presentacionesPaad: true, paadsDocente: true },
      },
      asignacionesCatedra: { select: { esResponsable: true } },
      equiposPlanificacion: { select: { planificacion: { select: { estado: true } } } },
      paadsAnuales: { select: { estado: true } },
    },
  });
  if (u.rol === UserRole.ADMINISTRADOR && (await prisma.usuario.count({ where: { rol: UserRole.ADMINISTRADOR } })) <= 1) {
    throw new Error('Es el único administrador del sistema.');
  }
  if (u.rol === UserRole.DIRECCION_CARRERA && u.carreraId) throw new Error('Dirige una carrera: asigná otra Dirección de Carrera antes.');
  if (u._count.planifResponsable > 0 || u.asignacionesCatedra.some((a) => a.esResponsable)) {
    throw new Error('Es Docente Responsable de una cátedra: designá otro responsable desde Estructura Académica.');
  }
  if (u._count.observaciones + u._count.observacionesPaad + u._count.dictamenesPaad + u._count.presentacionesPaad + u._count.paadsDocente > 0) {
    throw new Error('Tiene actividad registrada (observaciones, dictámenes o PAAD presentados): no se puede eliminar sin perder el historial.');
  }
  if (u.equiposPlanificacion.some((e) => !['BORRADOR', 'OBSERVADO'].includes(e.planificacion.estado))) {
    throw new Error('Integra planificaciones en revisión o aprobadas: no se puede eliminar.');
  }
  if (u.paadsAnuales.some((p) => p.estado !== 'BORRADOR')) throw new Error('Tiene un PAAD presentado: no se puede eliminar.');

  await prisma.$transaction(async (tx) => {
    await tx.integrantePlanificacion.deleteMany({ where: { docenteId: id } });
    await tx.asignacionCatedra.deleteMany({ where: { docenteId: id } });
    await tx.paadAnual.deleteMany({ where: { docenteId: id, estado: 'BORRADOR' } });
    await tx.usuario.delete({ where: { id } });
  });
  revalidarEquipos();
}

export async function designarResponsable(asignaturaId: string, cicloLectivo: number, asignacionId: string) {
  await requireAdmin();
  await prisma.$transaction(async (tx) => {
    const integrante = await tx.asignacionCatedra.findUnique({ where: { id: asignacionId } });
    if (!integrante || integrante.asignaturaId !== asignaturaId || integrante.cicloLectivo !== cicloLectivo) {
      throw new Error('El docente no pertenece al equipo de esa materia y ciclo.');
    }
    const planificacion = await tx.planificacion.findUnique({
      where: { asignaturaId_cicloLectivo: { asignaturaId, cicloLectivo } },
    });
    if (planificacion && !['BORRADOR', 'OBSERVADO'].includes(planificacion.estado)) {
      throw new Error('No se puede cambiar el responsable de una planificación que ya está en revisión o aprobada.');
    }
    await tx.asignacionCatedra.updateMany({ where: { asignaturaId, cicloLectivo }, data: { esResponsable: false } });
    await tx.asignacionCatedra.update({ where: { id: asignacionId }, data: { esResponsable: true } });
    if (planificacion) {
      await tx.integrantePlanificacion.upsert({ where: { planificacionId_docenteId: { planificacionId: planificacion.id, docenteId: integrante.docenteId } }, update: { cargoEnCatedra: integrante.categoria }, create: { planificacionId: planificacion.id, docenteId: integrante.docenteId, cargoEnCatedra: integrante.categoria } });
      await tx.planificacion.update({
        where: { id: planificacion.id },
        data: { docenteResponsableId: integrante.docenteId },
      });
    }
    await asegurarPaad(tx, integrante.docenteId, cicloLectivo);
  });

  revalidatePath('/admin');
  revalidatePath('/planificaciones', 'layout');
  revalidatePath('/paads', 'layout');
  revalidatePath('/mi-paad');
}
