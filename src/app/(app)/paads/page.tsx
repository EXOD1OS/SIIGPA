import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { puedeVerPaad, PAAD_LABELS } from '@/lib/paad';
import { PaadStatus } from '@prisma/client';

export default async function PaadsPage({ searchParams }: { searchParams: { ciclo?: string; estado?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMINISTRADOR', 'UAP', 'DIRECCION_CARRERA'].includes(session.user.rol)) notFound();
  const ciclo = searchParams.ciclo ?? String(new Date().getFullYear());
  const estado = Object.values(PaadStatus).includes(searchParams.estado as PaadStatus) ? searchParams.estado as PaadStatus : undefined;
  const candidates = await prisma.paadAnual.findMany({ where: {
    ...(ciclo !== 'todos' ? { cicloLectivo: Number(ciclo) || new Date().getFullYear() } : {}), ...(estado ? { estado } : {}),
  }, include: { docente: true, carreraEvaluadora: true }, orderBy: { updatedAt: 'desc' } });
  const permisos = await Promise.all(candidates.map(p => puedeVerPaad(prisma, session.user, p)));
  const visibles = candidates.filter((_, i) => permisos[i]);
  const ciclos = await prisma.paadAnual.findMany({ select: { cicloLectivo: true }, distinct: ['cicloLectivo'], orderBy: { cicloLectivo: 'desc' } });
  return <div className="max-w-5xl space-y-6"><h1 className="text-2xl font-semibold">PAAD anuales</h1>
    <form className="flex gap-4 items-end" method="get">
      <label>Ciclo lectivo<select name="ciclo" defaultValue={ciclo} className="block"><option value="todos">Todos</option>
        {[...new Set([new Date().getFullYear(), ...ciclos.map(c => c.cicloLectivo)])].sort((a,b) => b-a).map(c => <option key={c} value={c}>{c}</option>)}
      </select></label>
      <label>Estado<select name="estado" defaultValue={estado ?? ''} className="block"><option value="">Todos</option>
        {Object.entries(PAAD_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
      </select></label><button className="bg-primary px-4 py-2 rounded-lg">Filtrar PAAD</button>
    </form>
    <p>{visibles.length} PAAD</p>
    {visibles.map(p => <Link key={p.id} href={'/paads/' + p.id} className="block border border-border rounded-lg p-4">
      <p>{p.docente.nombre} {p.docente.apellido} · {p.cicloLectivo}</p>
      <p className="text-sm text-gray-400">{PAAD_LABELS[p.estado]} · {p.carreraEvaluadora?.nombre ?? 'Dirección pendiente'}
        {p.conflictoMigracion ? ' · Conflicto de copias pendiente' : ''}</p>
    </Link>)}
  </div>;
}
