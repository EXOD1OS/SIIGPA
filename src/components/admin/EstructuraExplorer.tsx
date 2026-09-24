'use client';

import { useMemo, useState } from 'react';
import { TreeItem } from './TreeItem';
import { Modal } from '@/components/Modal';
import { EquipoCatedraPanel, type AsignacionRow, type AsignaturaSeleccionada } from './EquipoCatedraPanel';

interface Asignatura {
  id: string;
  nombre: string;
  anoCursada: number;
}

interface Plan {
  id: string;
  ordenanza: string;
  enfoque: string;
  asignaturas: Asignatura[];
}

interface Carrera {
  id: string;
  nombre: string;
  codigo: string;
  departamento: { id: string; nombre: string };
  planes: Plan[];
}

interface Sede {
  id: string;
  nombre: string;
  esCapital: boolean;
  carreras: Carrera[];
}

interface Asignacion {
  id: string;
  asignaturaId: string;
  cicloLectivo: number;
  docenteId: string;
  categoria: string;
  esResponsable: boolean;
  docenteNombre: string;
}

export function EstructuraExplorer({
  sedes,
  asignaciones,
  docentesDisponibles,
}: {
  sedes: Sede[];
  asignaciones: Asignacion[];
  docentesDisponibles: { id: string; nombre: string }[];
}) {
  const [seleccion, setSeleccion] = useState<AsignaturaSeleccionada | null>(null);
  const [cicloLectivo, setCicloLectivo] = useState(new Date().getFullYear());
  const [query, setQuery] = useState('');

  const sedesFiltradas: Sede[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sedes;
    const matches = (s: string) => s.toLowerCase().includes(q);

    return sedes
      .map((sede) => ({
        ...sede,
        carreras: sede.carreras
          .map((carrera) => ({
            ...carrera,
            planes: carrera.planes
              .map((plan) => ({
                ...plan,
                asignaturas: plan.asignaturas.filter(
                  (a) =>
                    matches(a.nombre) ||
                    matches(carrera.nombre) ||
                    matches(plan.ordenanza) ||
                    matches(carrera.departamento.nombre) ||
                    matches(sede.nombre)
                ),
              }))
              .filter((plan) => plan.asignaturas.length > 0),
          }))
          .filter((carrera) => carrera.planes.length > 0),
      }))
      .filter((sede) => sede.carreras.length > 0);
  }, [sedes, query]);

  const asignacionesFiltradas: AsignacionRow[] = useMemo(() => {
    if (!seleccion) return [];
    return asignaciones
      .filter((a) => a.asignaturaId === seleccion.id && a.cicloLectivo === cicloLectivo)
      .map((a) => ({ id: a.id, docenteId: a.docenteId, docenteNombre: a.docenteNombre, categoria: a.categoria, esResponsable: a.esResponsable }));
  }, [asignaciones, seleccion, cicloLectivo]);

  function renderAsignaturas(asignaturas: Asignatura[], carreraNombre: string) {
    return asignaturas
      .slice()
      .sort((a, b) => a.anoCursada - b.anoCursada)
      .map((a) => (
        <TreeItem
          key={a.id}
          label={a.nombre}
          badge={`${a.anoCursada}° año`}
          active={seleccion?.id === a.id}
          onClick={() => setSeleccion({ id: a.id, nombre: a.nombre, carrera: carreraNombre })}
        />
      ));
  }

  const searchActive = query.trim() !== '';

  function renderPlanes(planes: Plan[], carreraNombre: string) {
    return planes.map((p) => (
      <TreeItem
        key={`${p.id}__${searchActive}`}
        label={p.ordenanza}
        badge={p.enfoque === 'COMPETENCIAS' ? 'Competencias' : 'Tradicional'}
        defaultOpen={searchActive}
      >
        {renderAsignaturas(p.asignaturas, carreraNombre)}
      </TreeItem>
    ));
  }

  function renderCarreras(carreras: Carrera[]) {
    return carreras.map((c) => (
      <TreeItem key={`${c.id}__${searchActive}`} label={`${c.nombre} (${c.codigo})`} defaultOpen={searchActive}>
        {renderPlanes(c.planes, c.nombre)}
      </TreeItem>
    ));
  }

  function renderSede(sede: Sede) {
    if (sede.esCapital) {
      const porDepartamento = new Map<string, { nombre: string; carreras: Carrera[] }>();
      for (const carrera of sede.carreras) {
        const key = carrera.departamento.id;
        if (!porDepartamento.has(key)) porDepartamento.set(key, { nombre: carrera.departamento.nombre, carreras: [] });
        porDepartamento.get(key)!.carreras.push(carrera);
      }
      return (
        <TreeItem key={`${sede.id}__${searchActive}`} label={sede.nombre} defaultOpen={searchActive}>
          {Array.from(porDepartamento.values()).map((d) => (
            <TreeItem key={`${d.nombre}__${searchActive}`} label={d.nombre} defaultOpen={searchActive}>
              {renderCarreras(d.carreras)}
            </TreeItem>
          ))}
        </TreeItem>
      );
    }

    return (
      <TreeItem key={`${sede.id}__${searchActive}`} label={sede.nombre} defaultOpen={searchActive}>
        {renderCarreras(sede.carreras)}
      </TreeItem>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Buscar sede, carrera, plan o asignatura..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full"
      />

      <div className="bg-surface border border-border rounded-xl p-4">
        {sedesFiltradas.map(renderSede)}
        {sedesFiltradas.length === 0 && <p className="text-sm text-gray-500 px-2 py-4">Sin resultados para la búsqueda.</p>}
      </div>

      <Modal open={!!seleccion} onClose={() => setSeleccion(null)} widthClass="max-w-2xl">
        <EquipoCatedraPanel
          asignatura={seleccion}
          cicloLectivo={cicloLectivo}
          onCicloChange={setCicloLectivo}
          asignaciones={asignacionesFiltradas}
          docentesDisponibles={docentesDisponibles}
        />
      </Modal>
    </div>
  );
}
