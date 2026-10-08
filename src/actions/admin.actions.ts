'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { defaultPaad } from '@/lib/defaults';
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
        await tx.paadDocente.create({
          data: {
            planificacionId,
            docenteId: creado.id,
            cargoEnCatedra: asignacion.categoria,
            datosPaad: defaultPaad() as any,
          },
        });
      }
    }

    return { usuario: creado, planificacionId };
  });

  revalidatePath('/admin/usuarios');
  if (input.asignacionInicial) {
    revalidatePath('/admin');
    revalidatePath('/planificaciones');
    if (planificacionId) revalidatePath(`/planificaciones/${planificacionId}`);
  }
  return usuario;
}

export async function generarPlanificaciones(cicloLectivo: number) {
  await requireAdmin();
  const resultado = await generarPlanificacionesDelCiclo(prisma, cicloLectivo);
  revalidatePath('/admin');
  revalidatePath('/planificaciones');
  revalidatePath('/dashboard');
  return resultado;
}

// ============================================================================
// Equipo de Cátedra (roster independiente de la Planificacion)
// ============================================================================

export async function agregarIntegranteCatedra(input: {
  asignaturaId: string;
  cicloLectivo: number;
  docenteId: string;
  categoria: string;
}) {
  await requireAdmin();

  const asignacion = await prisma.asignacionCatedra.upsert({
    where: {
      asignaturaId_cicloLectivo_docenteId: {
        asignaturaId: input.asignaturaId,
        cicloLectivo: input.cicloLectivo,
        docenteId: input.docenteId,
      },
    },
    update: { categoria: input.categoria },
    create: {
      asignaturaId: input.asignaturaId,
      cicloLectivo: input.cicloLectivo,
      docenteId: input.docenteId,
      categoria: input.categoria,
    },
  });

  revalidatePath('/admin');
  return asignacion;
}

export async function actualizarCategoriaIntegrante(asignacionId: string, categoria: string) {
  await requireAdmin();
  const asignacion = await prisma.asignacionCatedra.update({ where: { id: asignacionId }, data: { categoria } });
  revalidatePath('/admin');
  return asignacion;
}

export async function desvincularIntegrante(asignacionId: string) {
  await requireAdmin();
  await prisma.asignacionCatedra.delete({ where: { id: asignacionId } });
  revalidatePath('/admin');
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
      await tx.planificacion.update({
        where: { id: planificacion.id },
        data: { docenteResponsableId: integrante.docenteId },
      });
    }
  });

  revalidatePath('/admin');
  revalidatePath('/planificaciones');
}
