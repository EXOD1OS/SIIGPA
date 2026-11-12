import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaadPagina } from '@/components/documentos/PaadPagina';

/** Mi PAAD Anual: el mismo editor del prototipo, sobre el PAAD del docente en el ciclo elegido. */
export default async function MiPaadPage({ searchParams }: { searchParams: { ciclo?: string; asignatura?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.rol !== 'DOCENTE') notFound();
  const paads = await prisma.paadAnual.findMany({ where: { docenteId: session.user.id }, select: { id: true, cicloLectivo: true }, orderBy: { cicloLectivo: 'desc' } });
  const ciclos = [...new Set([new Date().getFullYear(), ...paads.map((p) => p.cicloLectivo)])].sort((a, b) => b - a);
  const solicitado = Number(searchParams.ciclo);
  const ciclo = ciclos.includes(solicitado) ? solicitado : ciclos[0];
  const actual = paads.find((p) => p.cicloLectivo === ciclo);

  return (
    <div className="space-y-6">
      {ciclos.length > 1 && (
        <form method="get" className="no-print flex flex-wrap items-center justify-end gap-2 text-xs">
          <label htmlFor="mi-paad-ciclo" className="font-medium text-muted">
            Ciclo lectivo
          </label>
          <select id="mi-paad-ciclo" name="ciclo" defaultValue={ciclo} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink">
            {ciclos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="rounded-lg border border-border bg-surface px-3 py-2 font-semibold text-primary hover:bg-soft">Ver</button>
        </form>
      )}
      {actual ? (
        <PaadPagina id={actual.id} actor={session.user} asignaturaId={searchParams.asignatura} />
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-surface px-5 py-12 text-center shadow-sm">
          <h1 className="text-base font-bold text-ink">Todavía no está habilitado tu PAAD {ciclo}</h1>
          <p className="mx-auto mt-2 max-w-lg text-xs text-muted">Administración debe generar el documento para este ciclo. Cuando esté disponible, aparecerá en esta pantalla.</p>
        </section>
      )}
    </div>
  );
}
