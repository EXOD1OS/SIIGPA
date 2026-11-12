import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { hasRole } from '@/lib/roles';
import { cargarPaacPrototipo } from '@/lib/prototipo-datos';
import { DocumentoPrototipo } from '@/components/documentos/DocumentoPrototipo';
import { ObservacionesSinAncla } from '@/components/documentos/ObservacionesSinAncla';
import { ArchivoExpedientePanel } from '@/components/forms/ArchivoExpedientePanel';

/** PAAC: editor literal del prototipo (PaacEditor vía DocumentFormView) hidratado con Prisma. */
export default async function PlanificacionDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const datos = await cargarPaacPrototipo(session.user, params.id);
  if (!datos) notFound();

  const rol = session.user.rol;
  const estado = datos.doc.state;
  const cerrado = ['APROBADO_PLENO', 'ELEVADO_AL_CONSEJO', 'FINALIZADO'].includes(estado);
  const esResponsable = datos.doc.owner === session.user.id;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-16">
      <DocumentoPrototipo tipo="PAAC" {...datos} />
      <ObservacionesSinAncla
        comments={datos.doc.comments}
        tipo="PAAC"
        documentoId={datos.doc.id}
        canResolve={(esResponsable || rol === UserRole.ADMINISTRADOR) && estado === 'OBSERVADO'}
        rolEliminacion={hasRole(rol, [UserRole.UAP, UserRole.DIRECCION_CARRERA, UserRole.ADMINISTRADOR]) && !cerrado ? rol : null}
      />
      <ArchivoExpedientePanel planificacionId={datos.doc.id} estado={estado} puedeConsolidar={hasRole(rol, [UserRole.ADMINISTRADOR, UserRole.CONSEJO_DEPARTAMENTAL])} />
    </div>
  );
}
