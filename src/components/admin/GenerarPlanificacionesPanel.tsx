'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generarPlanificaciones } from '@/actions/admin.actions';
import { NumberField, SectionCard } from '@/components/forms/fields';

export function GenerarPlanificacionesPanel() {
  const router = useRouter();
  const [cicloLectivo, setCicloLectivo] = useState(new Date().getFullYear());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof generarPlanificaciones>> | null>(null);

  function generar() {
    setError(null);
    setResultado(null);
    startTransition(async () => {
      try {
        setResultado(await generarPlanificaciones(cicloLectivo));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron generar las planificaciones.');
      }
    });
  }

  return (
    <SectionCard title="Planificaciones del ciclo">
      <p className="text-sm text-gray-400">
        Inicia un ciclo lectivo. Copia los equipos del ciclo anterior, crea un PAAC por materia y un PAAD personal por docente y año. Ambos se presentan de forma independiente. El historial queda intacto.
      </p>
      <div className="flex items-end gap-3">
        <div className="w-40">
          <NumberField label="Ciclo lectivo" value={cicloLectivo} onChange={setCicloLectivo} />
        </div>
        <button type="button" disabled={pending} onClick={generar} className="bg-primary hover:bg-primary-hover text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
          {pending ? 'Iniciando…' : 'Iniciar ciclo lectivo'}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {resultado && (
        <div className="text-sm text-gray-300 space-y-1">
          <p>{resultado.creadas} planificaciones creadas; {resultado.asignacionesCopiadas} integrantes habilitados desde el ciclo anterior; {resultado.yaExistentes} ya existían; {resultado.sinEquipo.length} sin equipo docente.</p>
          {resultado.responsablesProvisionales.length > 0 && <p>Responsable provisional (primer integrante) en {resultado.responsablesProvisionales.length} materias. Administración debe confirmar esas designaciones.</p>}
          {resultado.sinEquipo.length > 0 && <p>Sin equipo: {resultado.sinEquipo.join(', ')}.</p>}
        </div>
      )}
    </SectionCard>
  );
}
