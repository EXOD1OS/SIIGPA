import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ROL_LABELS, ESTADO_LABELS } from '@/types/planificacion';
import { StatusBadge } from '@/components/StatusBadge';
import { planificacionesVisiblesPara } from '@/lib/visibilidad';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const planificaciones = await planificacionesVisiblesPara(session.user);
  const cicloActual = new Date().getFullYear();
  const planifCicloActual = planificaciones.filter((p) => p.cicloLectivo === cicloActual);

  const porEstado: Record<string, number> = {};
  for (const p of planifCicloActual) {
    porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1;
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-white">Hola, {session.user.name}</h1>
      <p className="text-gray-400 mt-1">
        Rol: <span className="text-gray-300">{ROL_LABELS[session.user.rol]}</span>
      </p>

      <h2 className="text-sm font-medium text-gray-300 mt-8">Métricas — Ciclo lectivo {cicloActual}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
        {Object.entries(ESTADO_LABELS).map(([key, label]) => (
          <div key={key} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-3xl font-semibold text-white">{porEstado[key] ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Planificaciones recientes</h2>
        <Link href="/planificaciones" className="text-sm text-primary hover:underline">
          Ver todas →
        </Link>
      </div>

      <div className="mt-4 divide-y divide-border border border-border rounded-xl overflow-hidden bg-surface">
        {planificaciones.slice(0, 6).map((p) => (
          <Link
            key={p.id}
            href={`/planificaciones/${p.id}`}
            className="flex items-center justify-between px-5 py-4 hover:bg-background/50 transition-colors"
          >
            <div>
              <p className="text-sm text-gray-200">{p.asignatura.nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Ciclo {p.cicloLectivo} &middot; {p.asignatura.planEstudio.carrera.codigo}
              </p>
            </div>
            <StatusBadge estado={p.estado} />
          </Link>
        ))}
        {planificaciones.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-500">No hay planificaciones asociadas a tu usuario.</p>
        )}
      </div>
    </div>
  );
}
