import { notFound } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cargarPaadPrototipo } from '@/lib/prototipo-datos';
import type { PaadActor } from '@/lib/paad';
import { DocumentoPrototipo } from './DocumentoPrototipo';
import { ObservacionesSinAncla } from './ObservacionesSinAncla';
import { ConflictoPaadPanel } from './ConflictoPaadPanel';

/** PAAD anual: editor literal del prototipo (PaadEditor vía DocumentFormView) hidratado con Prisma. */
export async function PaadPagina({ id, actor, asignaturaId, carreraId }: { id: string; actor: PaadActor & { name?: string | null }; asignaturaId?: string; carreraId?: string }) {
  const datos = await cargarPaadPrototipo(actor, id);
  if (!datos) notFound();
  const { conflictoMigracion, carreraEvaluadoraId, puedePresentar: _p, ...props } = datos;

  const fuentes =
    actor.rol === UserRole.ADMINISTRADOR && conflictoMigracion
      ? (
          await prisma.paadDocente.findMany({
            where: { docenteId: datos.d.owner, planificacion: { cicloLectivo: datos.d.cycle } },
            include: { planificacion: { select: { asignatura: { select: { nombre: true } } } } },
            orderBy: { updatedAt: 'desc' },
          })
        ).map((c) => ({ id: c.id, nombre: `${c.planificacion.asignatura.nombre} · ${c.updatedAt.toLocaleDateString('es-AR')} · ${c.estadoPresento}` }))
      : [];
  const cerrado = datos.d.state === 'APROBADO';
  const propio = actor.rol === UserRole.ADMINISTRADOR || (actor.rol === UserRole.DOCENTE && actor.id === datos.d.owner);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-16">
      {fuentes.length > 0 && <ConflictoPaadPanel paadId={id} fuentes={fuentes} />}
      <DocumentoPrototipo
        tipo="PAAD"
        doc={props.d}
        E={props.E}
        role={props.role}
        uid={props.uid}
        permisos={props.permisos}
        presentacionId={props.presentacionId}
        contexto={{ asignaturaId: asignaturaId ?? null, carreraId: carreraId ?? (actor.rol === UserRole.DIRECCION_CARRERA ? actor.carreraId : carreraEvaluadoraId) }}
      />
      <ObservacionesSinAncla
        comments={datos.d.comments}
        tipo="PAAD"
        documentoId={id}
        canResolve={propio && datos.d.state === 'OBSERVADO' && !conflictoMigracion}
        rolEliminacion={[UserRole.UAP, UserRole.DIRECCION_CARRERA, UserRole.ADMINISTRADOR].some((r) => r === actor.rol) && !cerrado ? actor.rol : null}
      />
    </div>
  );
}
