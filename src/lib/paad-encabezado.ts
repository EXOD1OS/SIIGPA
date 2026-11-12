// Solo servidor (usa Prisma). Proyección de los Aspectos Generales del PAAD por cátedra.
import { prisma } from '@/lib/prisma';
import { cargoLegible } from '@/lib/informes';
import { FUNCION_CATEDRA, type AspectosGeneralesPaad, type CatedraPaad } from '@/types/paad';

const CURSO: Record<number, string> = { 1: 'Primer Año', 2: 'Segundo Año', 3: 'Tercer Año', 4: 'Cuarto Año', 5: 'Quinto Año', 6: 'Sexto Año' };
const REGIMEN: Record<string, string> = { '1C': 'Primer Cuatrimestre', '2C': 'Segundo Cuatrimestre', ANUAL: 'Anual' };

/** "Lastra Mariana Soledad" (apellido primero, como en el documento oficial). */
const nombreOficial = (u: { nombre: string; apellido: string } | null | undefined) => (u ? `${u.apellido} ${u.nombre}` : '');

/** Aspectos Generales sin cátedra: solo los datos del docente y del ciclo. */
export function aspectosSinCatedra(docente: { nombre: string; apellido: string; dni: string }, ciclo: number): AspectosGeneralesPaad {
  return {
    profesorACargo: '',
    presentadoPor: nombreOficial(docente),
    dni: docente.dni,
    anio: String(ciclo),
    sede: '',
    departamento: '',
    carrera: '',
    planEstudio: '',
    asignatura: '',
    curso: '',
    regimen: '',
    creditoHorario: '',
    cargo: '',
    funcion: '',
  };
}

/**
 * getDynamicPaadHeader para todas las cátedras del docente en el ciclo: sede, departamento, carrera, plan,
 * asignatura, curso, régimen y carga horaria salen de la asignatura; cargo y función, de la designación
 * del docente en ese Equipo de Cátedra (roster `AsignacionCatedra` + equipos de `Planificacion`).
 */
export async function catedrasPaad(docenteId: string, ciclo: number): Promise<CatedraPaad[]> {
  const docente = await prisma.usuario.findUnique({ where: { id: docenteId }, select: { nombre: true, apellido: true, dni: true } });
  if (!docente) return [];

  const asignaturaInclude = {
    planEstudio: { include: { carrera: { include: { sede: true } } } },
    departamentoRadicacion: true,
    asignacionesCatedra: { where: { cicloLectivo: ciclo, esResponsable: true }, include: { docente: { select: { nombre: true, apellido: true } } }, take: 1 },
    planificaciones: { where: { cicloLectivo: ciclo }, include: { docenteResponsable: { select: { id: true, nombre: true, apellido: true } } }, take: 1 },
  } as const;

  const [roster, equipos] = await Promise.all([
    prisma.asignacionCatedra.findMany({ where: { docenteId, cicloLectivo: ciclo }, include: { asignatura: { include: asignaturaInclude } } }),
    prisma.integrantePlanificacion.findMany({
      where: { docenteId, planificacion: { cicloLectivo: ciclo } },
      include: { planificacion: { include: { asignatura: { include: asignaturaInclude } } } },
    }),
  ]);

  type Asig = (typeof roster)[number]['asignatura'];
  const porAsignatura = new Map<string, { asig: Asig; cargo: string; esResponsable: boolean }>();
  for (const r of roster) porAsignatura.set(r.asignaturaId, { asig: r.asignatura, cargo: r.categoria, esResponsable: r.esResponsable });
  for (const e of equipos) {
    const a = e.planificacion.asignatura;
    const esResp = e.planificacion.docenteResponsableId === docenteId;
    const previo = porAsignatura.get(a.id);
    if (!previo) porAsignatura.set(a.id, { asig: a, cargo: e.cargoEnCatedra, esResponsable: esResp });
    else if (esResp) previo.esResponsable = true;
  }

  return [...porAsignatura.values()]
    .sort((x, y) => Number(y.esResponsable) - Number(x.esResponsable) || x.asig.nombre.localeCompare(y.asig.nombre, 'es'))
    .map(({ asig, cargo, esResponsable }) => {
      const carrera = asig.planEstudio.carrera;
      const aCargo = asig.asignacionesCatedra[0]?.docente ?? asig.planificaciones[0]?.docenteResponsable;
      return {
        asignaturaId: asig.id,
        carreraId: carrera.id,
        label: `${carrera.codigo} · ${asig.nombre}`,
        cargo,
        esResponsable,
        aspectos: {
          profesorACargo: nombreOficial(aCargo),
          presentadoPor: nombreOficial(docente),
          dni: docente.dni,
          anio: String(ciclo),
          sede: carrera.sede.nombre.replace(/^Sede Regional /, 'Delegación ').replace(/^Sede /, ''),
          departamento: asig.departamentoRadicacion.nombre.split(' (')[0],
          carrera: carrera.nombre,
          planEstudio: asig.planEstudio.ordenanza,
          asignatura: asig.nombre,
          curso: CURSO[asig.anoCursada] ?? `${asig.anoCursada}.º Año`,
          regimen: REGIMEN[asig.regimen] ?? asig.regimen,
          creditoHorario: `${asig.creditoHorario} hs`,
          cargo: cargoLegible(cargo, false),
          funcion: esResponsable ? FUNCION_CATEDRA.responsable : FUNCION_CATEDRA.integrante,
        },
      };
    });
}

/** Cátedra con la que se abre el PAAD: la pedida (si el docente la integra), la de la carrera preferida o la primera. */
export function catedraInicial(catedras: CatedraPaad[], opts: { asignaturaId?: string | null; carreraId?: string | null } = {}): string | null {
  if (opts.asignaturaId && catedras.some((c) => c.asignaturaId === opts.asignaturaId)) return opts.asignaturaId;
  const deCarrera = opts.carreraId ? catedras.find((c) => c.carreraId === opts.carreraId) : undefined;
  return (deCarrera ?? catedras[0])?.asignaturaId ?? null;
}
