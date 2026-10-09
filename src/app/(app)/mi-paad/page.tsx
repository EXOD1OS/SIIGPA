import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaadDetail } from '@/components/PaadDetail';

export default async function MiPaadPage({ searchParams }: { searchParams: { ciclo?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.rol !== 'DOCENTE') notFound();
  const paads = await prisma.paadAnual.findMany({ where: { docenteId: session.user.id }, orderBy: { cicloLectivo: 'desc' } });
  const ciclo = Number(searchParams.ciclo ?? new Date().getFullYear());
  const actual = paads.find(p => p.cicloLectivo === ciclo);
  const ciclos = [...new Set([new Date().getFullYear(), ...paads.map(p => p.cicloLectivo)])].sort((a,b) => b-a);
  return <div className="space-y-5">
    <form method="get" className="flex items-end gap-3"><label>Ciclo lectivo
      <select name="ciclo" defaultValue={ciclo} className="block">{ciclos.map(c => <option key={c} value={c}>{c}</option>)}</select>
    </label><button className="bg-primary px-4 py-2 rounded-lg">Consultar ciclo</button></form>
    {actual ? <PaadDetail id={actual.id} actor={session.user} /> : <p>Administración todavía no habilitó tu PAAD para este ciclo.</p>}
  </div>;
}
