import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { AdminUsuariosView } from '@/components/admin/AdminUsuariosView';
import type { AsignaturaOpcion } from '@/components/admin/UsuarioFormModal';
import type { Rol, UsuarioAdmin } from '@/components/admin/tipos';

/** Usuarios y accesos (Administración). Las cátedras se gestionan sobre el ciclo lectivo vigente. */
export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.rol !== UserRole.ADMINISTRADOR) redirect('/dashboard');
  const ciclo = new Date().getFullYear();

  const [usuarios, carreras, departamentos, asignaturas, asignaciones, planificaciones] = await Promise.all([
    prisma.usuario.findMany({
      // Nunca se seleccionan credenciales.
      select: { id: true, nombre: true, apellido: true, email: true, dni: true, rol: true, carreraId: true, mustChangePassword: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.carrera.findMany({ select: { id: true, codigo: true, nombre: true, departamentoId: true }, orderBy: { codigo: 'asc' } }),
    prisma.departamento.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.asignatura.findMany({
      select: { id: true, nombre: true, anoCursada: true, regimen: true, departamentoRadicacionId: true, planEstudio: { select: { carrera: { select: { id: true, codigo: true, departamentoId: true } } } } },
      orderBy: [{ anoCursada: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.asignacionCatedra.findMany({ where: { cicloLectivo: ciclo }, select: { asignaturaId: true, docenteId: true, categoria: true, esResponsable: true } }),
    prisma.planificacion.findMany({ where: { cicloLectivo: ciclo }, select: { asignaturaId: true, estado: true } }),
  ]);

  const nombreDe = new Map(usuarios.map((u) => [u.id, `${u.nombre} ${u.apellido}`]));
  const asigBy = new Map(asignaturas.map((a) => [a.id, a]));
  const estadoDe = new Map(planificaciones.map((p) => [p.asignaturaId, p.estado]));

  const opciones: AsignaturaOpcion[] = asignaturas.map((a) => {
    const car = a.planEstudio.carrera;
    const estado = estadoDe.get(a.id);
    return {
      id: a.id,
      nombre: a.nombre,
      carreraId: car.id,
      carreraCodigo: car.codigo,
      anoCursada: a.anoCursada,
      regimen: a.regimen,
      esMatricial: a.departamentoRadicacionId !== car.departamentoId,
      bloqueada: !!estado && !['BORRADOR', 'OBSERVADO'].includes(estado),
      equipo: asignaciones
        .filter((e) => e.asignaturaId === a.id)
        .map((e) => ({ docenteId: e.docenteId, nombre: nombreDe.get(e.docenteId) ?? 'Docente', cargo: e.categoria, esResponsable: e.esResponsable }))
        .sort((x, y) => Number(y.esResponsable) - Number(x.esResponsable)),
    };
  });

  const filas: UsuarioAdmin[] = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    dni: u.dni,
    rol: u.rol as Rol,
    carreraId: u.carreraId,
    mustChangePassword: u.mustChangePassword,
    catedras: asignaciones
      .filter((a) => a.docenteId === u.id)
      .map((a) => {
        const asig = asigBy.get(a.asignaturaId);
        return {
          asignaturaId: a.asignaturaId,
          asignaturaNombre: asig?.nombre ?? 'Asignatura',
          carreraId: asig?.planEstudio.carrera.id ?? '',
          carreraCodigo: asig?.planEstudio.carrera.codigo ?? '?',
          cargo: a.categoria,
          esResponsable: a.esResponsable,
        };
      }),
  }));

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Usuarios y accesos</h1>
          <p className="mt-0.5 text-xs text-muted">Alta de docentes y autoridades. El DNI es la contraseña provisoria y se pide cambiarla en el primer ingreso.</p>
        </div>
        <AdminTabs />
      </div>
      <AdminUsuariosView usuarios={filas} carreras={carreras} departamentos={departamentos} asignaturas={opciones} ciclo={ciclo} sesionId={session.user.id} />
    </div>
  );
}
