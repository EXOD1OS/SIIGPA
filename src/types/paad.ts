// PAAD — Plan Anual de Actividades del Docente (Anexo III, Ord. Nº 171/19).
// Los puntos 1) a 8) (`PaadAnual.datosPaad`) son únicos por docente y ciclo lectivo; los Aspectos Generales
// se proyectan dinámicamente según la cátedra desde la que se consulta (ver getDynamicPaadHeader).

/** Datos de la ficha "Aspectos Generales" (proyectados según la cátedra, solo lectura). */
export interface AspectosGeneralesPaad {
  profesorACargo: string;
  presentadoPor: string;
  dni: string;
  anio: string;
  sede: string;
  departamento: string;
  carrera: string;
  planEstudio: string;
  asignatura: string;
  curso: string;
  regimen: string;
  creditoHorario: string;
  /** Cargo del docente en esa cátedra (Equipo de Cátedra). */
  cargo: string;
  /** Función en la cátedra: responsable o integrante del equipo. */
  funcion: string;
}

/** Una cátedra del docente en el ciclo con sus Aspectos Generales ya proyectados. */
export interface CatedraPaad {
  asignaturaId: string;
  carreraId: string;
  /** "ISI · Programación I" para selectores. */
  label: string;
  cargo: string;
  esResponsable: boolean;
  aspectos: AspectosGeneralesPaad;
}

export const CAMPOS_ASPECTOS: { key: keyof AspectosGeneralesPaad; label: string }[] = [
  { key: 'profesorACargo', label: 'Profesor Titular / a cargo' },
  { key: 'presentadoPor', label: 'Plan presentado por' },
  { key: 'dni', label: 'DNI' },
  { key: 'anio', label: 'Año' },
  { key: 'sede', label: 'Sede / Delegación' },
  { key: 'departamento', label: 'Departamento Académico' },
  { key: 'carrera', label: 'Carrera' },
  { key: 'planEstudio', label: 'Plan de Estudio' },
  { key: 'asignatura', label: 'Asignatura' },
  { key: 'curso', label: 'Curso' },
  { key: 'regimen', label: 'Régimen' },
  { key: 'creditoHorario', label: 'Carga horaria' },
  { key: 'cargo', label: 'Cargo en la cátedra' },
  { key: 'funcion', label: 'Función en la cátedra' },
];

/** Punto 8) del PAAD: sigue a los apartados 1) a 7) con la misma numeración. */
export const NUMERO_DISTRIBUCION = 8;
export const TITULO_DISTRIBUCION = 'Distribución Horaria';

export const FUNCION_CATEDRA = {
  responsable: 'Docente Responsable de Cátedra (Titular / a cargo)',
  integrante: 'Integrante del Equipo de Cátedra',
} as const;
