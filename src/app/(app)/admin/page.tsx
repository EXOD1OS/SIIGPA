import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { EstructuraExplorer } from '@/components/admin/EstructuraExplorer';
import { AdminTabs } from '@/components/admin/AdminTabs';

export default async function AdminHubPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.rol !== UserRole.ADMINISTRADOR) redirect('/dashboard');

  const [sedes, asignaciones, docentes] = await Promise.all([
    prisma.sede.findMany({
      include: {
        carreras: {
          include: {
            departamento: true,
            planes: { include: { asignaturas: true } },
          },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.asignacionCatedra.findMany({ include: { docente: true }, orderBy: { createdAt: 'asc' } }),
    prisma.usuario.findMany({
      where: { rol: UserRole.DOCENTE },
      orderBy: { apellido: 'asc' },
    }),
  ]);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Administración</h1>
        <p className="text-gray-400 text-sm mt-1">Gestión académica y de usuarios, y trazabilidad de planificaciones activas.</p>
      </div>

      <AdminTabs />

      <div>
        <h2 className="text-lg font-medium text-white">Gestión Académica</h2>
        <p className="text-gray-400 text-sm mt-1">
          En Sede Capital se agrupa por departamento; en sedes regionales las carreras cuelgan directo de la sede. Buscá o
          desplegá hasta llegar a una asignatura para gestionar su equipo de cátedra.
        </p>
      </div>

      <div>
        <EstructuraExplorer
          sedes={sedes}
          asignaciones={asignaciones.map((a) => ({
            id: a.id,
            asignaturaId: a.asignaturaId,
            cicloLectivo: a.cicloLectivo,
            docenteId: a.docenteId,
            categoria: a.categoria,
            esResponsable: a.esResponsable,
            docenteNombre: `${a.docente.nombre} ${a.docente.apellido}`,
          }))}
          docentesDisponibles={docentes.map((d) => ({ id: d.id, nombre: `${d.nombre} ${d.apellido}` }))}
        />
      </div>
    </div>
  );
}
