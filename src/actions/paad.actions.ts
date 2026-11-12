'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { operarPaad, puedeVerPaad, resolverObservacionPersonal } from '@/lib/paad';
import { elegirFuenteMigracion } from '@/lib/migrar-paad';
import type { PaadData } from '@/types/planificacion';

async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('No autenticado.');
  return session.user;
}
function refrescar() {
  revalidatePath('/mi-paad');
  revalidatePath('/paads', 'layout');
  revalidatePath('/planificaciones', 'layout');
  revalidatePath('/admin');
  revalidatePath('/dashboard');
}
export async function guardarBorradorPaad(paadId: string, datos: PaadData) {
  await operarPaad(prisma, await actor(), paadId, 'guardar', { datos }); refrescar();
}
export async function presentarPaad(paadId: string) {
  await operarPaad(prisma, await actor(), paadId, 'presentar', {}); refrescar();
}
export async function observarPaad(input: { paadId: string; presentacionId: string; campoPath: string; mensaje: string }) {
  await operarPaad(prisma, await actor(), input.paadId, 'observar', input); refrescar();
}
export async function resolverObservacionPaad(id: string) {
  await resolverObservacionPersonal(prisma, await actor(), id); refrescar();
}
export async function dictaminarPaad(input: { paadId: string; presentacionId: string; resultado: 'FAVORABLE' | 'REQUIERE_CORRECCION'; mensaje: string }) {
  await operarPaad(prisma, await actor(), input.paadId, 'dictaminar', input); refrescar();
}
export async function asignarDireccionPaad(paadId: string, carreraId: string) {
  await operarPaad(prisma, await actor(), paadId, 'direccion', { carreraId }); refrescar();
}
/**
 * UAP y Dirección eliminan solo las observaciones de su área (el Administrador, cualquiera),
 * mientras el PAAD no esté cerrado (APROBADO).
 */
export async function eliminarObservacionAction(observacionId: string) {
  const user = await actor();
  if (!['UAP', 'DIRECCION_CARRERA', 'ADMINISTRADOR'].includes(user.rol)) throw new Error('No autorizado.');
  const obs = await prisma.observacionPaad.findUnique({ where: { id: observacionId }, include: { paad: true } });
  if (!obs) throw new Error('Observación no encontrada.');
  if (user.rol !== 'ADMINISTRADOR' && obs.rolAutor !== user.rol) throw new Error('Solo podés eliminar observaciones de tu área.');
  if (!(await puedeVerPaad(prisma, user, obs.paad))) throw new Error('PAAD no encontrado o no autorizado.');
  if (obs.paad.estado === 'APROBADO') throw new Error('El PAAD está aprobado: sus observaciones no se pueden eliminar.');
  await prisma.observacionPaad.delete({ where: { id: observacionId } });
  refrescar();
}

export async function resolverConflictoPaad(paadId: string, fuenteId: string) {
  if ((await actor()).rol !== 'ADMINISTRADOR') throw new Error('No autorizado.');
  await elegirFuenteMigracion(prisma, paadId, fuenteId); refrescar();
}
