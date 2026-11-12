'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { almacenamientoConfigurado, archivarExpedienteFinal } from '@/lib/archivo-expediente';

/**
 * Consolida y sube (o vuelve a subir) el expediente PDF inmutable de una planificación FINALIZADA:
 * cubre las que se cerraron sin almacenamiento configurado o con un error de S3/MinIO.
 * No modifica la planificación: solo regenera sus archivos a partir de los datos ya protocolizados.
 */
export async function consolidarExpedienteAction(planificacionId: string): Promise<{ archivados: number }> {
  const session = await getServerSession(authOptions);
  const permitidos: UserRole[] = [UserRole.ADMINISTRADOR, UserRole.CONSEJO_DEPARTAMENTAL];
  if (!session?.user || !permitidos.includes(session.user.rol)) {
    throw new Error('No autorizado.');
  }
  if (!almacenamientoConfigurado()) throw new Error('El almacenamiento S3/MinIO no está configurado.');

  const archivados = await prisma.$transaction(
    async (tx) => {
      const planif = await tx.planificacion.findUniqueOrThrow({ where: { id: planificacionId } });
      if (planif.estado !== 'FINALIZADO' || !planif.numeroExpediente || !planif.numeroResolucion) {
        throw new Error('Solo se archiva el expediente de una planificación finalizada con expediente y resolución.');
      }
      return archivarExpedienteFinal(tx, planificacionId, planif.numeroExpediente, planif.numeroResolucion, planif.fechaAprobacionCd ?? new Date());
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  revalidatePath(`/planificaciones/${planificacionId}`);
  return { archivados: archivados.length };
}
