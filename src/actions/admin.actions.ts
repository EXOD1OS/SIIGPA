'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

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
}) {
  await requireAdmin();

  if (input.rol === UserRole.DIRECCION_CARRERA && !input.carreraId) {
    throw new Error('Debe seleccionar una carrera para el rol Dirección de Carrera.');
  }

  const passwordHash = await bcrypt.hash(input.dni, 10);

  const usuario = await prisma.usuario.create({
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

  revalidatePath('/admin/usuarios');
  return usuario;
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

  await prisma.$transaction([
    prisma.asignacionCatedra.updateMany({
      where: { asignaturaId, cicloLectivo },
      data: { esResponsable: false },
    }),
    prisma.asignacionCatedra.update({
      where: { id: asignacionId },
      data: { esResponsable: true },
    }),
  ]);

  revalidatePath('/admin');
}
