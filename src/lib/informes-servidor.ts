// Solo servidor (usa Prisma): importarlo desde páginas o Server Actions.
import { prisma } from '@/lib/prisma';
import { planificacionVisiblePara } from '@/lib/visibilidad';
import { dictamenesPaac } from '@/types/planificacion';
import { cargoLegible, contextoInformes, encabezadoInforme } from '@/lib/informes';
import type { ContextoInformes, IntegranteInforme } from '@/types/informes';

type Planif = NonNullable<Awaited<ReturnType<typeof planificacionVisiblePara>>>;

/** Equipo de cátedra (responsable primero) con el estado real de presentación de su PaadAnual del ciclo. */
export async function equipoConPaad(planif: Pick<Planif, 'cicloLectivo' | 'docenteResponsableId' | 'integrantes'>) {
  const paads = await prisma.paadAnual.findMany({
    where: { cicloLectivo: planif.cicloLectivo, docenteId: { in: planif.integrantes.map((i) => i.docenteId) } },
    select: { docenteId: true, estado: true, presentaciones: { select: { id: true }, take: 1 } },
  });
  return [...planif.integrantes]
    .sort((a, b) => Number(b.docenteId === planif.docenteResponsableId) - Number(a.docenteId === planif.docenteResponsableId))
    .map((i): IntegranteInforme & { presento: boolean; paadEstado: string | null } => {
      const paad = paads.find((p) => p.docenteId === i.docenteId);
      return {
        docenteId: i.docenteId,
        nombre: `${i.docente.nombre} ${i.docente.apellido}`,
        cargo: cargoLegible(i.cargoEnCatedra, i.docenteId === planif.docenteResponsableId),
        // "Presentó" = el PaadAnual del ciclo tiene al menos una presentación (salió de Borrador).
        presento: !!paad && (paad.presentaciones.length > 0 || paad.estado !== 'BORRADOR'),
        paadEstado: paad?.estado ?? null,
      };
    });
}

export async function construirContextoInformes(planif: Planif): Promise<ContextoInformes> {
  const equipo = await equipoConPaad(planif);
  const abiertas = (planif.observaciones ?? []).filter((o) => !o.resuelto);
  const d = dictamenesPaac({
    estado: planif.estado,
    informePedagogico: planif.informePedagogico,
    informeDisciplinar: planif.informeDisciplinar,
    observacionesAbiertas: abiertas,
  });
  const a = planif.asignatura;
  return contextoInformes({
    encabezado: encabezadoInforme({
      sede: a.planEstudio.carrera.sede.nombre,
      carrera: a.planEstudio.carrera.nombre,
      plan: a.planEstudio.ordenanza,
      ciclo: planif.cicloLectivo,
      asignatura: a.nombre,
      anoCursada: a.anoCursada,
      regimen: a.regimen,
      creditoHorario: a.creditoHorario,
    }),
    ciclo: planif.cicloLectivo,
    equipo,
    datosPaac: planif.datosPaac,
    informePedagogico: planif.informePedagogico,
    informeDisciplinar: planif.informeDisciplinar,
    pedApproved: d.pedApproved,
    discApproved: d.discApproved,
  });
}
