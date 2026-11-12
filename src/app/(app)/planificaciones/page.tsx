import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cargarBandejaPaac } from '@/lib/prototipo-datos';
import { BandejaPlanificaciones } from '@/components/documentos/Bandejas';

/** Planificaciones (PAAC): bandeja literal del prototipo (PlanificacionesList) con los datos de Prisma. */
export default async function PlanificacionesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const datos = await cargarBandejaPaac(session.user);
  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <Suspense>
        <BandejaPlanificaciones {...datos} />
      </Suspense>
    </div>
  );
}
