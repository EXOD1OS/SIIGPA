import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { cargarBandejaPaad } from '@/lib/prototipo-datos';
import { BandejaPaads } from '@/components/documentos/Bandejas';

/** Bandeja de PAAD: vista literal del prototipo (PaadsListView). La única acción por fila es «Ver PAAD». */
export default async function PaadsPage({ searchParams }: { searchParams?: { ciclo?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMINISTRADOR', 'UAP', 'DIRECCION_CARRERA'].includes(session.user.rol)) notFound();
  const solicitado = Number(searchParams?.ciclo);
  const ciclo = Number.isInteger(solicitado) && solicitado >= 2000 && solicitado <= 2100 ? solicitado : new Date().getFullYear();
  const datos = await cargarBandejaPaad(session.user, ciclo);
  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <Suspense>
        <BandejaPaads {...datos} />
      </Suspense>
    </div>
  );
}
