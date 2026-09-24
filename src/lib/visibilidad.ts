import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const include = {
  asignatura: { include: { planEstudio: { include: { carrera: { include: { sede: true } } } }, carreraEvaluadora: true } },
  docenteResponsable: true,
  paads: { include: { docente: true } },
} satisfies Prisma.PlanificacionInclude;

type SessionUser = { id: string; rol: UserRole; carreraId: string | null };

// La carrera responsable de evaluar disciplinarmente una asignatura es la propia,
// salvo que esté explícitamente delegada a otra (caso de materias como Derecho
// Informático, que pertenecen a un plan de una carrera pero se radican y evalúan
// en la dirección de otra carrera/departamento).
function carreraEvaluadoraWhere(carreraId: string): Prisma.PlanificacionWhereInput {
  return {
    asignatura: {
      OR: [{ carreraEvaluadoraId: carreraId }, { carreraEvaluadoraId: null, planEstudio: { carreraId } }],
    },
  };
}

export async function planificacionesVisiblesPara(user: SessionUser) {
  let where: Prisma.PlanificacionWhereInput = {};

  switch (user.rol) {
    case UserRole.ADMINISTRADOR:
    case UserRole.UAP:
    case UserRole.CONSEJO_DEPARTAMENTAL:
      where = {};
      break;
    case UserRole.DOCENTE:
      where = { OR: [{ docenteResponsableId: user.id }, { paads: { some: { docenteId: user.id } } }] };
      break;
    case UserRole.DIRECCION_CARRERA:
      where = user.carreraId ? carreraEvaluadoraWhere(user.carreraId) : {};
      break;
  }

  return prisma.planificacion.findMany({
    where,
    include,
    orderBy: { updatedAt: 'desc' },
  });
}

export async function planificacionVisiblePara(user: SessionUser, id: string) {
  const planif = await prisma.planificacion.findUnique({
    where: { id },
    include: {
      ...include,
      observaciones: { include: { autor: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!planif) return null;

  if (user.rol === UserRole.DOCENTE) {
    const esResponsable = planif.docenteResponsableId === user.id;
    const esIntegranteEquipo = planif.paads.some((p) => p.docenteId === user.id);
    if (!esResponsable && !esIntegranteEquipo) return null;
  }
  if (user.rol === UserRole.DIRECCION_CARRERA) {
    const carreraEvaluadoraId = planif.asignatura.carreraEvaluadoraId ?? planif.asignatura.planEstudio.carreraId;
    if (carreraEvaluadoraId !== user.carreraId) return null;
  }

  return planif;
}
