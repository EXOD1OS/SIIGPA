'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ConsejoDashboardView } from './ConsejoDashboardView';
import { DireccionDashboardView } from './DireccionDashboardView';
import { DocenteDashboardView } from './DocenteDashboardView';
import { UapDashboardView } from './UapDashboardView';
import { queryFiltros, type DatosDashboard, type NavDashboard } from './datos';

/** Elige el dashboard según el rol y conecta el deep-linking con `router.push`. */
export function DashboardInicio({ rol, datos, carreraId }: { rol: string; datos: DatosDashboard; carreraId: string | null }) {
  const router = useRouter();
  const nav = useMemo<NavDashboard>(
    () => ({
      goToPlanificaciones: (f = {}) => router.push(`/planificaciones${queryFiltros({ ...f })}`),
      goToPaads: (f = {}) => router.push(`/paads${queryFiltros({ ...f })}`),
      onOpenDoc: (id) => router.push(`/planificaciones/${id}`),
      onOpenPaad: (id) => router.push(`/paads/${id}`),
    }),
    [router]
  );

  switch (rol) {
    case 'DOCENTE':
      return <DocenteDashboardView datos={datos} nav={nav} onVerMiPaad={() => router.push(`/mi-paad?ciclo=${datos.ciclo}`)} />;
    case 'DIRECCION_CARRERA':
      return <DireccionDashboardView datos={datos} nav={nav} careerId={carreraId} />;
    case 'CONSEJO_DEPARTAMENTAL':
      return <ConsejoDashboardView datos={datos} nav={nav} />;
    case 'ADMINISTRADOR':
      return <UapDashboardView datos={datos} nav={nav} subtitulo={`Administración · Seguimiento institucional · Ciclo Lectivo ${datos.ciclo}`} />;
    default:
      return <UapDashboardView datos={datos} nav={nav} />;
  }
}
