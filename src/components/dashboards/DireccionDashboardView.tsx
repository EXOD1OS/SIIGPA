'use client';

import { useState, type ReactNode } from 'react';
import { IconAlert, IconClock, IconDocs, IconSeal } from '@/components/layout/icons';
import {
  COLOR,
  CareerComparisonMatrix,
  DonutChartCard,
  KpiFilterCard,
  MetricaBarra,
  Panel,
  Pastillas,
  SaludoDashboard,
  SelectableCatedraCard,
  Vacio,
  linkCls,
  modosPorCarrera,
  pct,
  tarjetaDe,
} from './DashboardKit';
import { ESTADOS_FAVORABLES, ESTADOS_REVISION_PAAC, contar, estadosPaad, type DatosDashboard, type NavDashboard, type PaacResumen } from './datos';

type FiltroDir = 'revision' | 'observados' | 'borrador' | 'favorables' | 'conDictamen';
const TODAS = 'todas';

/**
 * Inicio de la Dirección de Carrera: control disciplinar, cumplimiento docente y elevación al Consejo.
 * El alcance (todas las carreras o una) cambia gráficos, KPIs y lista. Fuera de su carrera, la Dirección
 * consulta los totales pero no abre listados ni documentos (mismo criterio de visibilidad que el listado).
 */
export function DireccionDashboardView({ datos, nav, careerId }: { datos: DatosDashboard; nav: NavDashboard; careerId: string | null }) {
  const { nombre, ciclo, carreras } = datos;
  const [alcance, setAlcance] = useState<string>(careerId ?? TODAS);
  const [filtro, setFiltro] = useState<FiltroDir>('revision');
  const f = { ciclo };

  const enAlcance = (carreraId: string | null | undefined) => alcance === TODAS || carreraId === alcance;
  const paacsCiclo = datos.paacs.filter((d) => d.cycle === ciclo);
  const paadsCiclo = datos.paads.filter((d) => d.cycle === ciclo);
  const paacs = paacsCiclo.filter((d) => enAlcance(d.carreraId));
  const paads = paadsCiclo.filter((d) => enAlcance(d.evalCareer));
  const propia = (d: PaacResumen) => !!careerId && d.evalCarreraId === careerId;
  const soloConsulta = (carreraId: string) => (carreraId === careerId ? undefined : 'Solo podés abrir los listados y documentos de tu carrera.');

  // Partición disciplinar (cada PAAC en un solo grupo de la dona).
  const favorables = paacs.filter((d) => ESTADOS_FAVORABLES.includes(d.state));
  const enRevision = paacs.filter((d) => ESTADOS_REVISION_PAAC.includes(d.state));
  const grupos: Record<FiltroDir, PaacResumen[]> = {
    favorables,
    revision: enRevision.filter((d) => !d.discApproved),
    observados: paacs.filter((d) => d.state === 'OBSERVADO'),
    borrador: paacs.filter((d) => d.state === 'BORRADOR'),
    // Dictamen disciplinar ya emitido: favorables + en revisión esperando solo a la UAP.
    conDictamen: [...favorables, ...enRevision.filter((d) => d.discApproved)],
  };
  const total = paacs.length;
  const ep = estadosPaad(paads);
  // La bandeja de PAAD se abre con la carrera propia (las ajenas no son navegables).
  const carreraPaad = careerId ? { ...f, careerId } : f;
  const listosParaElevar = contar(paacsCiclo, (d) => propia(d) && d.state === 'APROBADO_PLENO');

  // Cobertura: asignaturas con Docente Responsable designado en el ciclo.
  const cob = Object.entries(datos.cobertura).filter(([id]) => enAlcance(id));
  const asigs = cob.reduce((s, [, c]) => s + c.asignaturas, 0);
  const cubiertas = cob.reduce((s, [, c]) => s + c.cubiertas, 0);

  const lista = grupos[filtro];
  const kpis: { key: FiltroDir; titulo: string; color: string; icono: ReactNode; ir: () => void }[] = [
    { key: 'revision', titulo: 'En revisión disciplinar', color: COLOR.revision, icono: <IconClock className="h-4 w-4" />, ir: () => nav.goToPlanificaciones({ ...f, state: 'ENVIADO_A_REVISION' }) },
    { key: 'observados', titulo: 'Observados', color: COLOR.observado, icono: <IconAlert className="h-4 w-4" />, ir: () => nav.goToPlanificaciones({ ...f, state: 'OBSERVADO' }) },
    { key: 'borrador', titulo: 'PAAC no presentados', color: COLOR.pendiente, icono: <IconDocs className="h-4 w-4" />, ir: () => nav.goToPlanificaciones({ ...f, state: 'BORRADOR' }) },
    { key: 'favorables', titulo: 'Listos para elevar / finalizados', color: COLOR.aprobado, icono: <IconSeal className="h-4 w-4" />, ir: () => nav.goToPlanificaciones({ ...f, vista: 'historicas' }) },
  ];

  return (
    <div className="space-y-6">
      <SaludoDashboard
        nombre={nombre}
        subtitulo={`Dirección de Carrera · Seguimiento Disciplinar y Cumplimiento Docente · Ciclo ${ciclo}`}
        extra={
          <Pastillas
            etiqueta="Alcance del panel"
            valor={alcance}
            onChange={setAlcance}
            opciones={[{ key: TODAS, label: 'Todas las carreras' }, ...carreras.map((c) => ({ key: c.id, label: c.sigla }))]}
          />
        }
      />

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <DonutChartCard
          className="lg:col-span-7"
          titulo="Avance disciplinar de planificaciones (PAAC)"
          centro="PAAC"
          segmentos={[
            { key: 'conDictamen', label: 'Dictamen disciplinar aprobado', valor: grupos.conDictamen.length, color: COLOR.aprobado, onClick: () => setFiltro('conDictamen') },
            { key: 'revision', label: 'En revisión disciplinar', valor: grupos.revision.length, color: COLOR.revision, onClick: () => setFiltro('revision') },
            { key: 'observados', label: 'Observados', valor: grupos.observados.length, color: COLOR.observado, onClick: () => setFiltro('observados') },
            { key: 'borrador', label: 'No presentados (borrador)', valor: grupos.borrador.length, color: COLOR.pendiente, onClick: () => setFiltro('borrador') },
          ]}
          pie={<MetricaBarra titulo="Cobertura de Equipos de Cátedra" valor={cubiertas} total={asigs} texto={`${cubiertas} de ${asigs} asignaturas con Docente Responsable`} />}
        />
        <DonutChartCard
          className="lg:col-span-5"
          vertical
          titulo="Cumplimiento de PAAD del cuerpo docente"
          centro="PAAD"
          segmentos={[
            { key: 'aprobado', label: 'PAAD aprobados', valor: ep.aprobado, color: COLOR.aprobado, onClick: () => nav.goToPaads({ ...carreraPaad, state: 'APROBADO' }) },
            { key: 'revision', label: 'En revisión', valor: ep.revision, color: COLOR.revision, onClick: () => nav.goToPaads({ ...carreraPaad, state: 'ENVIADO_A_REVISION' }) },
            { key: 'observado', label: 'Observados', valor: ep.observado, color: COLOR.observado, onClick: () => nav.goToPaads({ ...carreraPaad, state: 'OBSERVADO' }) },
            { key: 'borrador', label: 'No presentados', valor: ep.borrador, color: COLOR.pendiente, onClick: () => nav.goToPaads({ ...carreraPaad, state: 'BORRADOR' }) },
          ]}
          pie={
            <div className="space-y-3">
              <MetricaBarra titulo="Tasa de presentación de PAAD" valor={paads.length - ep.borrador} total={paads.length} />
              {listosParaElevar > 0 ? (
                <button type="button" onClick={() => nav.goToPlanificaciones({ ...f, state: 'APROBADO_PLENO' })} className={linkCls}>
                  Con aprobación plena: listos para elevar al Consejo ({listosParaElevar}) →
                </button>
              ) : (
                <button type="button" onClick={() => nav.goToPaads(carreraPaad)} className={linkCls}>
                  Ir a Bandeja de PAADs →
                </button>
              )}
            </div>
          }
        />
      </div>

      <div role="group" aria-label="Filtrar las cátedras" className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            titulo="Comparativa por carrera"
            modos={modosPorCarrera({
              datos,
              paacs: paacsCiclo,
              paads: paadsCiclo,
              nav,
              avancePaac: (l) => pct(contar(l, (d) => d.discApproved), l.length),
              soloConsulta,
            })}
            nota="Avance PAAC: cátedras con Informe Disciplinar aprobado. Las carreras ajenas se muestran en consulta."
          />
        </div>
        <Panel
          titulo={filtro === 'conDictamen' ? 'Cátedras · con dictamen disciplinar' : 'Cátedras'}
          className="lg:col-span-5"
          accion={<span className="text-[11px] tabular-nums text-muted">{lista.length}</span>}
        >
          {lista.length === 0 ? (
            <Vacio>No hay cátedras en este estado.</Vacio>
          ) : (
            <ul className="space-y-3.5">
              {lista.map((d) => (
                <SelectableCatedraCard key={d.id} c={tarjetaDe(d)} onOpen={propia(d) ? () => nav.onOpenDoc(d.id) : undefined} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
