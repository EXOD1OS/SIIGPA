import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { puedeVerPaad } from '@/lib/paad';
import { PaadsList, type PaadFila } from '@/components/PaadsList';

export default async function PaadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMINISTRADOR', 'UAP', 'DIRECCION_CARRERA'].includes(session.user.rol)) notFound();

  const [candidatos, carreras] = await Promise.all([
    prisma.paadAnual.findMany({
      include: {
        docente: { select: { nombre: true, apellido: true } },
        carreraEvaluadora: { select: { codigo: true, nombre: true } },
        observaciones: { where: { resuelto: false }, select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.carrera.findMany({ select: { id: true, codigo: true, nombre: true }, orderBy: { codigo: 'asc' } }),
  ]);
  const permisos = await Promise.all(candidatos.map((p) => puedeVerPaad(prisma, session.user, p)));
  const visibles = candidatos.filter((_, i) => permisos[i]);

  // Cátedras de cada docente en el ciclo del PAAD (roster de cátedra + equipos de planificación).
  const docentes = [...new Set(visibles.map((p) => p.docenteId))];
  const asignaturaSel = { select: { id: true, nombre: true, planEstudio: { select: { carrera: { select: { codigo: true } } } } } } as const;
  const [roster, equipos] = await Promise.all([
    prisma.asignacionCatedra.findMany({ where: { docenteId: { in: docentes } }, select: { docenteId: true, cicloLectivo: true, categoria: true, asignatura: asignaturaSel } }),
    prisma.integrantePlanificacion.findMany({
      where: { docenteId: { in: docentes } },
      select: { docenteId: true, cargoEnCatedra: true, planificacion: { select: { cicloLectivo: true, asignatura: asignaturaSel } } },
    }),
  ]);
  const catedras = new Map<string, Map<string, { carrera: string; asignatura: string; cargo: string }>>();
  const agregar = (docenteId: string, ciclo: number, a: { id: string; nombre: string; planEstudio: { carrera: { codigo: string } } }, cargo: string) => {
    const clave = `${docenteId}:${ciclo}`;
    const m = catedras.get(clave) ?? new Map();
    if (!m.has(a.id)) m.set(a.id, { carrera: a.planEstudio.carrera.codigo, asignatura: a.nombre, cargo });
    catedras.set(clave, m);
  };
  roster.forEach((r) => agregar(r.docenteId, r.cicloLectivo, r.asignatura, r.categoria));
  equipos.forEach((e) => agregar(e.docenteId, e.planificacion.cicloLectivo, e.planificacion.asignatura, e.cargoEnCatedra));

  const filas: PaadFila[] = visibles.map((p) => ({
    id: p.id,
    docente: `${p.docente.nombre} ${p.docente.apellido}`,
    cycle: p.cicloLectivo,
    state: p.estado,
    evalCareer: p.carreraEvaluadoraId,
    evalSigla: p.carreraEvaluadora?.codigo ?? null,
    conflicto: p.conflictoMigracion,
    pendientes: p.observaciones.length,
    catedras: [...(catedras.get(`${p.docenteId}:${p.cicloLectivo}`)?.values() ?? [])],
  }));

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Bandeja de PAAD Anuales</h1>
        <p className="mt-0.5 text-xs text-muted">
          Evaluación institucional por docente, cátedra, Dirección evaluadora o estado. El PAAD queda aprobado con la conformidad de la UAP o de la
          Dirección de Carrera; la decisión se toma dentro de cada PAAD.
        </p>
      </div>
      <Suspense>
        <PaadsList filas={filas} carreras={carreras.map((c) => ({ id: c.id, sigla: c.codigo, nombre: c.nombre }))} />
      </Suspense>
    </div>
  );
}
