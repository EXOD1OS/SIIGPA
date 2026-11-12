'use client';

import { useState, type ReactNode } from 'react';
import { IconAlert, IconCheck, IconClock, IconDocs } from '@/components/layout/icons';
import {
  COLOR,
  CareerComparisonMatrix,
  ChipAccion,
  DonutChartCard,
  KpiFilterCard,
  MetricaBarra,
  Panel,
  SaludoDashboard,
  SelectableCatedraCard,
  Vacio,
  linkCls,
  modosPorCarrera,
  pct,
  tarjetaDe,
} from './DashboardKit';
import { ESTADOS_REVISION_PAAC, contar, estadosPaad, type DatosDashboard, type NavDashboard, type PaacResumen } from './datos';

type FiltroUap = 'revision' | 'observados' | 'borrador' | 'emitidos';

/**
 * Inicio de la UAP (y del Administrador): supervisión pedagógica transversal a todas las carreras.
 * Los KPIs filtran la cola de trabajo; "Ir a bandeja" y las celdas por carrera abren los listados filtrados.
 */
export function UapDashboardView({ datos, nav, subtitulo }: { datos: DatosDashboard; nav: NavDashboard; subtitulo?: string }) {
  const { nombre, ciclo } = datos;
  const [filtro, setFiltro] = useState<FiltroUap>('revision');
  const paacs = datos.paacs.filter((d) => d.cycle === ciclo);
  const paads = datos.paads.filter((d) => d.cycle === ciclo);
  const f = { ciclo };

  // Partición pedagógica (cada PAAC en un solo grupo).
  const grupos: Record<FiltroUap, PaacResumen[]> = {
    emitidos: paacs.filter((d) => d.pedApproved),
    revision: paacs.filter((d) => !d.pedApproved && ESTADOS_REVISION_PAAC.includes(d.state)),
    observados: paacs.filter((d) => !d.pedApproved && d.state === 'OBSERVADO'),
    borrador: paacs.filter((d) => !d.pedApproved && d.state === 'BORRADOR'),
  };
  const total = paacs.length;

  // Observaciones de la UAP: resueltas sobre emitidas.
  const obsUap = paacs.flatMap((d) => d.comments.filter((o) => o.area === 'uap'));
  const ep = estadosPaad(paads);

  const cola = grupos[filtro];
  const TITULO_COLA: Record<FiltroUap, string> = {
    revision: 'Cola prioritaria · En revisión UAP',
    observados: 'Cola · Observados',
    borrador: 'Cola · No presentados',
    emitidos: 'Cola · Informes emitidos',
  };

  const kpis: { key: FiltroUap; titulo: string; color: string; icono: ReactNode; ir: () => void }[] = [
    { key: 'revision', titulo: 'En revisión UAP', color: COLOR.revision, icono: <IconClock className="h-4 w-4" />, ir: () => nav.goToPlanificaciones({ ...f, state: 'ENVIADO_A_REVISION' }) },
    { key: 'observados', titulo: 'Observados', color: COLOR.observado, icono: <IconAlert className="h-4 w-4" />, ir: () => nav.goToPlanificaciones({ ...f, state: 'OBSERVADO' }) },
    { key: 'borrador', titulo: 'PAAC no presentados', color: COLOR.pendiente, icono: <IconDocs className="h-4 w-4" />, ir: () => nav.goToPlanificaciones({ ...f, state: 'BORRADOR' }) },
    { key: 'emitidos', titulo: 'Informes emitidos (Anexo III)', color: COLOR.aprobado, icono: <IconCheck className="h-4 w-4" />, ir: () => nav.goToPlanificaciones(f) },
  ];

  return (
    <div className="space-y-6">
      <SaludoDashboard
        nombre={nombre}
        subtitulo={subtitulo ?? `Unidad de Asesoramiento Pedagógico (UAP) · Ciclo Lectivo ${ciclo}`}
        extra={grupos.revision.length > 0 && <ChipAccion onClick={() => setFiltro('revision')}>{grupos.revision.length} PAAC(s) pendientes de dictamen UAP</ChipAccion>}
      />

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <DonutChartCard
          className="lg:col-span-7"
          titulo="Panorama pedagógico de PAAC"
          centro="PAAC"
          segmentos={[
            { key: 'emitidos', label: 'Con dictamen UAP aprobado', valor: grupos.emitidos.length, color: COLOR.aprobado, onClick: () => setFiltro('emitidos') },
            { key: 'revision', label: 'En revisión (pendientes UAP)', valor: grupos.revision.length, color: COLOR.revision, onClick: () => setFiltro('revision') },
            { key: 'observados', label: 'Observados', valor: grupos.observados.length, color: COLOR.observado, onClick: () => setFiltro('observados') },
            { key: 'borrador', label: 'No presentados (borrador)', valor: grupos.borrador.length, color: COLOR.pendiente, onClick: () => setFiltro('borrador') },
          ]}
          pie={
            <MetricaBarra
              titulo="Tasa de resolución de observaciones pedagógicas"
              valor={contar(obsUap, (o) => o.resolved)}
              total={obsUap.length}
              texto={`${contar(obsUap, (o) => o.resolved)} de ${obsUap.length} subsanadas`}
            />
          }
        />
        <DonutChartCard
          className="lg:col-span-5"
          vertical
          titulo="Estado general de PAAD docentes"
          centro="PAAD"
          segmentos={[
            { key: 'aprobado', label: 'PAAD aprobado', valor: ep.aprobado, color: COLOR.aprobado, onClick: () => nav.goToPaads({ ...f, state: 'APROBADO' }) },
            { key: 'revision', label: 'En revisión', valor: ep.revision, color: COLOR.revision, onClick: () => nav.goToPaads({ ...f, state: 'ENVIADO_A_REVISION' }) },
            { key: 'observado', label: 'Observados', valor: ep.observado, color: COLOR.observado, onClick: () => nav.goToPaads({ ...f, state: 'OBSERVADO' }) },
            { key: 'borrador', label: 'No presentados', valor: ep.borrador, color: COLOR.pendiente, onClick: () => nav.goToPaads({ ...f, state: 'BORRADOR' }) },
          ]}
          pie={
            <div className="space-y-3">
              <MetricaBarra titulo="Tasa de presentación de PAAD" valor={paads.length - ep.borrador} total={paads.length} />
              <button type="button" onClick={() => nav.goToPaads(f)} className={linkCls}>
                Ir a Bandeja de PAADs →
              </button>
            </div>
          }
        />
      </div>

      <div role="group" aria-label="Filtrar la cola de trabajo" className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiFilterCard
            key={k.key}
            titulo={k.titulo}
            valor={grupos[k.key].length}
            detalle={`${pct(grupos[k.key].length, total)}% de ${total} cátedras`}
            icono={k.icono}
            color={k.color}
            activo={filtro === k.key}
            onFiltrar={() => setFiltro(k.key)}
            onIr={k.ir}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <CareerComparisonMatrix
            titulo="Desglose por carrera"
            modos={modosPorCarrera({ datos, paacs, paads, nav, avancePaac: (l) => pct(contar(l, (d) => d.pedApproved), l.length) })}
            nota="Avance PAAC: cátedras con Informe Pedagógico emitido. Avance PAAD: planes aprobados."
          />
        </div>
        <Panel titulo={TITULO_COLA[filtro]} className="lg:col-span-5" accion={<span className="text-[11px] tabular-nums text-muted">{cola.length}</span>}>
          {cola.length === 0 ? (
            <Vacio>No hay cátedras en este estado.</Vacio>
          ) : (
            <ul className="space-y-3.5">
              {cola.map((d) => (
                <SelectableCatedraCard key={d.id} c={tarjetaDe(d)} onOpen={() => nav.onOpenDoc(d.id)} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
