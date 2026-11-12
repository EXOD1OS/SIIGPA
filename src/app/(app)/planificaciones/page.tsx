import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { planificacionesVisiblesPara } from '@/lib/visibilidad';
import { avancePaac } from '@/lib/dashboard-datos';
import { dictamenesPaac } from '@/types/planificacion';
import { PlanificacionesList, type PlanifFila } from '@/components/PlanificacionesList';

const DESCRIPCION_ALCANCE: Record<string, string> = {
  DOCENTE: 'Planificaciones donde sos responsable o integrás el equipo de cátedra (ciclo actual e históricos).',
  DIRECCION_CARRERA: 'Planificaciones que evalúa tu carrera, en proceso e históricas.',
  UAP: 'Todas las carreras y departamentos (unidad transversal).',
  CONSEJO_DEPARTAMENTAL: 'Planificaciones evaluadas favorablemente, elevadas al Consejo y finalizadas (protocolización en 2 instancias).',
  ADMINISTRADOR: 'Todas las planificaciones del departamento.',
};

export default async function PlanificacionesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user;

  const planificaciones = await planificacionesVisiblesPara(user);
  const puedeProtocolizar = user.rol === 'CONSEJO_DEPARTAMENTAL' || user.rol === 'ADMINISTRADOR';
  // Observaciones abiertas del PAAC (para "Observaciones pendientes" y el dictamen "Con observaciones").
  const abiertas = await prisma.itemObservacion.findMany({
    where: { planificacionId: { in: planificaciones.map((p) => p.id) }, documentoTipo: 'PAAC', resuelto: false },
    select: { planificacionId: true, rolAutor: true },
  });
  const abiertasPor = new Map<string, { rolAutor: string }[]>();
  for (const o of abiertas) abiertasPor.set(o.planificacionId, [...(abiertasPor.get(o.planificacionId) ?? []), o]);

  const filas: PlanifFila[] = planificaciones.map((p) => {
    const carrera = p.asignatura.planEstudio.carrera;
    const obs = abiertasPor.get(p.id) ?? [];
    const d = dictamenesPaac({ estado: p.estado, informePedagogico: p.informePedagogico, informeDisciplinar: p.informeDisciplinar, observacionesAbiertas: obs });
    return {
      id: p.id,
      asignatura: p.asignatura.nombre,
      carreraId: carrera.id,
      carreraSigla: carrera.codigo,
      carreraNombre: carrera.nombre,
      cycle: p.cicloLectivo,
      regimen: p.asignatura.regimen,
      responsable: `${p.docenteResponsable.nombre} ${p.docenteResponsable.apellido}`,
      state: p.estado,
      iniciado: avancePaac(p.datosPaac).iniciado,
      ped: d.ped,
      disc: d.disc,
      pendientes: obs.length,
      expediente: p.numeroExpediente,
      resolucion: p.numeroResolucion,
      editable: user.rol === 'DOCENTE' && p.docenteResponsableId === user.id && ['BORRADOR', 'OBSERVADO'].includes(p.estado),
      // Consejo Departamental (y Administración): protocolización en 2 instancias desde la bandeja.
      protocolo:
        puedeProtocolizar && ['APROBADO_PLENO', 'ELEVADO_AL_CONSEJO'].includes(p.estado)
          ? {
              id: p.id,
              estado: p.estado,
              asignatura: p.asignatura.nombre,
              detalle: [carrera.codigo, p.asignatura.planEstudio.ordenanza, `Ciclo ${p.cicloLectivo}`, `${p.docenteResponsable.nombre} ${p.docenteResponsable.apellido}`].join(' · '),
              expediente: p.numeroExpediente,
              fechaElevacion: p.fechaElevacion ? p.fechaElevacion.toLocaleDateString('es-AR') : null,
              pedApproved: d.pedApproved,
              discApproved: d.discApproved,
            }
          : null,
    };
  });

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Planificaciones (PAAC)</h1>
        <p className="mt-0.5 text-xs text-muted">{DESCRIPCION_ALCANCE[user.rol] ?? ''}</p>
      </div>
      <Suspense>
        <PlanificacionesList filas={filas} />
      </Suspense>
    </div>
  );
}
