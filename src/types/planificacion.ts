export type DocentCategory = 'TITULAR' | 'ASOCIADO' | 'ADJUNTO' | 'JTP' | 'AYUDANTE';

export type NivelAporte = 0 | 1 | 2 | 3;

// ============================================================================
// PAAC — Plan Anual de Actividades de Cátedra
// Dos variantes reales según el plan de estudio de la asignatura:
//  - Tradicional (Ord. HCS 171/2019 Anexo II + Ord. HCS 219/2022): planes
//    anteriores (TUI y los planes viejos de ISI/LSI).
//  - Por Competencias: planes nuevos de ISI y LSI, que ya no se referencian a
//    la 171/219 sino a la matriz de competencias de egreso de la carrera.
// ============================================================================

export interface PaacTraditionalData {
  encabezado: {
    carrera: string;
    planEstudio: string;
    asignatura: string;
    curso: number;
    regimen: 'ANUAL' | '1C' | '2C';
    resolucionConeau?: string;
    resolucionMinisterial?: string;
  };
  fundamentacion: {
    introduccion: { importancia: string; relacionPerfil: string };
    diagnostico: { articulacionCorrelativas: string; articulacionMismoAno: string; infraestructura: string };
  };
  objetivos: {
    catedra: { conceptuales: string[]; procedimentales: string[]; actitudinales: string[] };
    especificos: string[];
  };
  metodologiaEnsenanza: {
    clasesTeoricas: string;
    clasesPracticas: string;
    recursosDidacticos: string[];
  };
  metodologiaEvaluacion: {
    tipos: ('INICIAL' | 'DE_PROCESO' | 'FINAL')[];
    modalidades: (
      | 'ORAL_INDIVIDUAL'
      | 'ORAL_GRUPAL'
      | 'ESCRITA_INDIVIDUAL'
      | 'ESCRITA_GRUPAL'
      | 'INFORME_MONOGRAFIA'
      | 'TRABAJOS_PRACTICOS'
    )[];
    criterios: string;
    regimenAprobacion: { promocional: string; regular: string; libre: string };
  };
  trabajosPracticos: {
    detalleTp: string;
    laboratorio?: string;
    trabajoCampo?: { objetivos: string; horas: number; lugar: string };
  };
  bibliografia: {
    basica: { autor: string; titulo: string; ano: number; editorial: string }[];
    complementaria: { autor: string; titulo: string; ano: number; editorial: string }[];
  };
  distribucionHoraria: { horasSemanales: number; horasTotales: number; cronograma: string };
}

export interface CompetenciaItem {
  codigo: string; // CG1, CE1.1, etc.
  tipo: 'GENERAL_TECNOLOGICA' | 'GENERAL_SOCIAL_POLITICA_ACTITUDINAL' | 'ESPECIFICA';
  detalle: string;
  nivelAporte: NivelAporte;
}

export interface PaacCompetenciasData {
  encabezado: {
    sede: string;
    carrera: string;
    planEstudio: string;
    curso: string;
    asignatura: string;
    regimen: 'ANUAL' | '1C' | '2C';
    creditoHorario: number;
    horasTeoricas: number;
    horasPracticas: number;
    equipoCatedra: { cargo: DocentCategory; nombre: string }[];
    contenidosMinimos: string;
    nivelIntensidad: NivelAporte;
    relacionTeoricoPractica: string;
  };
  fundamentacion: {
    importanciaAsignatura: string;
    matrizCompetencias: CompetenciaItem[];
    diagnostico: {
      articulacionCorrelativas: string;
      articulacionMismoAno: string;
      analisisEstudiantes: string;
      infraestructuraRequerida: string;
    };
  };
  objetivosPropositoRA: {
    objetivosCarrera: string;
    propositoAsignatura: string[];
    resultadosAprendizaje: { codigo: string; detalle: string }[];
  };
  metodologia: {
    enfoque: string;
    propuestaDesarrolloCompetencias: {
      competencia: string;
      resultadoAprendizaje: string;
      unidadTema: string;
      guiaTp: string;
      actividadFormativa: string;
      estrategiaEnsenanza: string;
    }[];
  };
  contenidos: { unidad: number; titulo: string; detalle: string }[];
  programaTrabajosPracticos: {
    numero: number;
    titulo: string;
    proposito: string[];
    modalidad: string;
    unidadTemas: string;
  }[];
  evaluacion: {
    tipos: ('INICIAL' | 'DE_PROCESO' | 'FINAL')[];
    criterios: string[];
    tecnicas: string[];
    regimenAprobacion: { promocional: string; regular: string; libre: string };
  };
  bibliografia: {
    basica: { titulo: string; autores: string; editorial: string; enlace?: string; ano: number }[];
    complementaria: { titulo: string; autores: string; editorial: string; enlace?: string; ano: number }[];
  };
  horariosClases: {
    dia: 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO';
    horasTeoricas?: string;
    horasPracticas?: string;
  }[];
  cronograma: {
    semana: number;
    unidad?: number;
    horasTeoricas?: number;
    tpNumero?: number;
    horasPracticas?: number;
    evaluacion?: string;
  }[];
}

export type PaacData = PaacTraditionalData | PaacCompetenciasData;

// ============================================================================
// PAAD — Plan Anual de Actividades del Docente (Ord. HCS 171/2019 Anexo III)
// Ocho secciones, una presentación por cada integrante del equipo de cátedra.
// ============================================================================

export interface PaadData {
  actividadEnsenanza: {
    cursosAtendidos: string[];
    capacitaciones: { lugar: string; fecha: string; tematica: string; areaConocimiento: string; nombreCapacitacion: string }[];
    materialElaborado: { areaConocimiento: string; tipo: string; autores: string; fecha: string }[];
    otrosTrabajosDocentes: { areaTematica: string; lugar: string; fecha: string; destinatarios: string; nivel: string }[];
  };
  investigacion: { proyecto: string; descripcion: string; cargo: string; numeroResolucion: string; etapa: string }[];
  formacionRecursosHumanos: { detalle: string };
  formacionAcademica: { detalle: string };
  extension: { proyecto: string; destinatarios: string; tiempoLugar: string; alumnosInvolucrados: string; informe: string }[];
  gestion: { detalle: string };
  otrasActividades: string[];
  distribucionHoraria: {
    actividad: 'ENSENANZA' | 'INVESTIGACION' | 'EXTENSION' | 'FORMACION' | 'GESTION';
    lunes?: string;
    martes?: string;
    miercoles?: string;
    jueves?: string;
    viernes?: string;
    sabado?: string;
  }[];
}

// ============================================================================
// Informe Pedagógico — UAP (Ord. HCS 219/2022 Anexo III)
// ============================================================================

export interface PedagogicalReportData {
  equipoCatedra: { cargo: DocentCategory; nombre: string }[];
  aspectosGenerales: {
    introduccion: 'PRESENTA_COMPLETA' | 'PRESENTA_INCOMPLETA' | 'NO_PRESENTA';
    diagnostico: 'PRESENTA_COMPLETA' | 'PRESENTA_INCOMPLETA' | 'NO_PRESENTA';
    objetivosPropositoRA: 'CONCRETOS_CLAROS' | 'CONFUSOS' | 'NO_PRESENTA';
    claseRecursosDidacticos: 'PRESENTA_Y_DESCRIBE' | 'INCOMPLETO' | 'NO_PRESENTA';
  };
  aspectosCurriculares: {
    contenidos: 'DESARROLLADOS_EN_UNIDADES' | 'INCOMPLETO' | 'NO_PRESENTA';
    trabajosPracticos: 'ARTICULADOS_CON_TEORIA' | 'NO_ARTICULADOS' | 'NO_APLICA';
    trabajosPracticosLaboratorio: 'ARTICULADOS' | 'NO_ARTICULADOS' | 'NO_APLICA';
    trabajosCampo: 'ACORDE' | 'NO_ACORDE' | 'NO_APLICA';
    evaluacionInicial: 'FORMATIVA_Y_SUMATIVA' | 'SOLO_SUMATIVA' | 'NO_PRESENTA';
    regimenAprobacion: 'PROMOCIONAL_REGULAR_LIBRE' | 'INCOMPLETO';
    horarios: 'PRESENTA' | 'NO_PRESENTA';
    distribucionHoraria: 'PRESENTA' | 'NO_PRESENTA';
  };
  dictamen: 'FAVORABLE' | 'REQUIERE_CORRECCION';
  observaciones?: string;
}

// ============================================================================
// Informe Disciplinar — Dirección de Carrera (Ord. HCS 219/2022 Anexo IV)
// ============================================================================

export interface DisciplinaryReportData {
  contenidos: 'CUMPLE' | 'NO_CUMPLE';
  trabajosPracticos: {
    tp: 'ACORDE' | 'NO_ACORDE';
    laboratorio: 'ACORDE' | 'NO_ACORDE' | 'NO_APLICA';
    campo: 'ACORDE' | 'NO_ACORDE' | 'NO_APLICA';
  };
  bibliografia: { basica: 'PRESENTA' | 'NO_PRESENTA'; complementaria: 'PRESENTA' | 'NO_PRESENTA' };
  controlPaad: { docenteId: string; nombreDocente: string; cargo: DocentCategory; estado: 'PRESENTO' | 'NO_PRESENTO' }[];
  dictamen: 'CUMPLE' | 'REQUIERE_CORRECCION';
  observaciones?: string;
}

// Nombres de estado unificados con el prototipo SIIGPA (ENVIADO_A_REVISION siempre "En revisión").
export const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADO_A_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  APROBADO_PEDAGOGICO: 'Aprob. pedagógico',
  APROBADO_DISCIPLINAR: 'Aprob. disciplinar',
  APROBADO_PLENO: 'Evaluado favorablemente',
  ELEVADO_AL_CONSEJO: 'Elevado al Consejo',
  FINALIZADO: 'Finalizado',
};

/** En proceso: todavía falta algún dictamen o corrección. */
export const ESTADOS_ACTIVOS = ['BORRADOR', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR'];
/** Históricas / aprobadas: ya cuentan con ambos dictámenes favorables. */
export const ESTADOS_HISTORICOS = ['APROBADO_PLENO', 'ELEVADO_AL_CONSEJO', 'FINALIZADO'];

/** Etapa de elaboración del documento PAAC (columna "PAAC" de la bandeja). */
export type EtapaPaac = 'SIN_INICIAR' | 'EN_ELABORACION' | 'EN_CORRECCION' | 'PRESENTADO';
export function etapaPaac(estado: string, iniciado: boolean): EtapaPaac {
  if (estado === 'BORRADOR') return iniciado ? 'EN_ELABORACION' : 'SIN_INICIAR';
  if (estado === 'OBSERVADO') return 'EN_CORRECCION';
  return 'PRESENTADO';
}
export const ETAPA_PAAC: Record<EtapaPaac, { label: string; cls: string }> = {
  SIN_INICIAR: { label: 'Sin iniciar', cls: 'text-muted' },
  EN_ELABORACION: { label: 'En elaboración', cls: 'text-amber-700 dark:text-amber-400' },
  EN_CORRECCION: { label: 'Correcciones', cls: 'text-amber-700 dark:text-amber-400' },
  PRESENTADO: { label: 'Presentado', cls: 'text-emerald-700 dark:text-emerald-400' },
};

/** Dictamen visible de un área en la bandeja. */
export type Dictamen = 'PENDIENTE' | 'FAVORABLE' | 'CON_OBSERVACIONES';
export const DICTAMEN_LABELS: Record<Dictamen, string> = {
  PENDIENTE: 'Pendiente',
  FAVORABLE: 'Favorable',
  CON_OBSERVACIONES: 'Con observaciones',
};
export const DICTAMEN_BADGE: Record<Dictamen, string> = {
  PENDIENTE: 'bg-slate-500/15 text-muted',
  FAVORABLE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  CON_OBSERVACIONES: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

const ESTADOS_CON_PED = ['APROBADO_PEDAGOGICO', 'APROBADO_PLENO', 'ELEVADO_AL_CONSEJO', 'FINALIZADO'];
const ESTADOS_CON_DISC = ['APROBADO_DISCIPLINAR', 'APROBADO_PLENO', 'ELEVADO_AL_CONSEJO', 'FINALIZADO'];

/**
 * Dictámenes de UAP (pedagógico) y Dirección (disciplinar) a partir del estado y los informes guardados.
 * La aprobación se lee del estado; "con observaciones" del informe con REQUIERE_CORRECCION o de observaciones abiertas.
 */
export function dictamenesPaac(p: {
  estado: string;
  informePedagogico?: unknown;
  informeDisciplinar?: unknown;
  observacionesAbiertas?: { rolAutor: string }[];
}) {
  const dictamen = (v: unknown) => (v && typeof v === 'object' ? (v as { dictamen?: string }).dictamen : undefined);
  const pedApproved = ESTADOS_CON_PED.includes(p.estado);
  const discApproved = ESTADOS_CON_DISC.includes(p.estado);
  const abiertas = p.observacionesAbiertas ?? [];
  const pedObservado = !pedApproved && (dictamen(p.informePedagogico) === 'REQUIERE_CORRECCION' || abiertas.some((o) => o.rolAutor === 'UAP'));
  const discObservado =
    !discApproved && (dictamen(p.informeDisciplinar) === 'REQUIERE_CORRECCION' || abiertas.some((o) => o.rolAutor === 'DIRECCION_CARRERA'));
  const area = (ok: boolean, obs: boolean): Dictamen => (ok ? 'FAVORABLE' : obs ? 'CON_OBSERVACIONES' : 'PENDIENTE');
  return { pedApproved, discApproved, ped: area(pedApproved, pedObservado), disc: area(discApproved, discObservado) };
}

/** Avance de carga: porcentaje de secciones de primer nivel con algún dato cargado. */
export function progresoSecciones(datos: unknown): { completados: number; total: number; pct: number } {
  const tieneDato = (v: unknown): boolean => {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'boolean') return false;
    if (Array.isArray(v)) return v.some(tieneDato);
    if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(tieneDato);
    return false;
  };
  const secciones = datos && typeof datos === 'object' && !Array.isArray(datos) ? Object.values(datos as Record<string, unknown>) : [];
  const completados = secciones.filter(tieneDato).length;
  const total = secciones.length;
  return { completados, total, pct: total ? Math.round((completados / total) * 100) : 0 };
}

export const ROL_LABELS: Record<string, string> = {
  DOCENTE: 'Docente',
  UAP: 'UAP',
  DIRECCION_CARRERA: 'Dirección de Carrera',
  CONSEJO_DEPARTAMENTAL: 'Consejo Departamental',
  ADMINISTRADOR: 'Administrador',
};
