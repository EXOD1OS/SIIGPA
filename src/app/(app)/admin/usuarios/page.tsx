import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { CrearUsuarioForm } from '@/components/forms/CrearUsuarioForm';
import { UsuariosPanel, type UsuarioRow } from '@/components/admin/UsuariosPanel';

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.rol !== UserRole.ADMINISTRADOR) redirect('/dashboard');

  const [usuarios, carreras] = await Promise.all([
    prisma.usuario.findMany({
      include: {
        carrera: true,
        asignacionesCatedra: { include: { asignatura: true }, orderBy: { cicloLectivo: 'desc' } },
      },
      orderBy: [{ rol: 'asc' }, { apellido: 'asc' }],
    }),
    prisma.carrera.findMany({ orderBy: { nombre: 'asc' } }),
  ]);

  const filas: UsuarioRow[] = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    dni: u.dni,
    rol: u.rol,
    carrera: u.carrera?.codigo ?? null,
    materias: u.asignacionesCatedra.map((a) => ({
      nombre: a.asignatura.nombre,
      categoria: a.categoria,
      cicloLectivo: a.cicloLectivo,
    })),
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Administración</h1>
        <p className="text-gray-400 text-sm mt-1">Gestión académica y de usuarios, y trazabilidad de planificaciones activas.</p>
      </div>

      <AdminTabs />

      <div>
        <h2 className="text-lg font-medium text-white">Usuarios</h2>
        <p className="text-gray-400 text-sm mt-1">
          Los usuarios no pueden autoregistrarse: los crea el Administrador. El DNI se usa como contraseña temporal y se exige
          el cambio en el primer ingreso.
        </p>
      </div>

      <CrearUsuarioForm carreras={carreras} />

      <UsuariosPanel usuarios={filas} />
    </div>
  );
}
