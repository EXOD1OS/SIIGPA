// Informes de evaluación del PAAC según la Ord. HCS N° 219/2022 (DACEFyN – UNLaR):
// Anexo III (Informe Pedagógico, UAP) y Anexo IV (Informe Disciplinar, Dirección de Carrera).

export const OPC_CUMPLE = ['Cumple', 'No Cumple'] as const;
export const OPC_ACORDE = ['Acorde', 'No Acorde', 'No corresponde'] as const;
export const OPC_PRESENTA = ['Presenta', 'No Presenta'] as const;
export const OPC_PAAD = ['Presentó', 'No Presentó'] as const;
export const OPC_COMPLETITUD = ['Presenta Completa', 'Presenta Parcialmente', 'No Presenta'] as const;

/** Sugerencias de los campos de texto libre del informe pedagógico (se ofrecen como lista desplegable). */
export const SUGERENCIAS_PED = {
  objetivos: ['Concretos y claros', 'Poco precisos', 'No presenta'],
  clase: ['Presenta y describe la metodología del proceso de enseñanza', 'Presenta la metodología sin detallar los recursos didácticos', 'No presenta'],
  recursos: ['Presenta recursos didácticos acordes a las estrategias', 'Recursos didácticos a precisar', 'No presenta'],
  tp: ['Articulados con la teoría', 'Parcialmente articulados con la teoría', 'No corresponde'],
  evaluacion: ['Formativa y Sumativa. Criterios claros. Técnicas de evaluación apropiadas', 'Solo sumativa. Criterios a precisar', 'No presenta'],
} as const;

export interface PaadIntegrante {
  docenteId: string;
  nombre: string;
  cargo: string;
  valor: string;
}

/** Cuadro del Informe Disciplinar (Anexo IV). */
export interface InformeDisciplinarDatos {
  contenidos: string;
  tp: string;
  tpLab: string;
  tpCampo: string;
  bibBasica: string;
  bibComplementaria: string;
  paads: PaadIntegrante[];
}

/** Ítem con selector discreto y comentario del evaluador. */
export interface ItemValorado {
  valor: string;
  texto: string;
}

/** Grilla del Informe Pedagógico (Anexo III). */
export interface InformePedagogicoDatos {
  // A) Aspectos generales
  introduccion: ItemValorado;
  diagnostico: ItemValorado;
  objetivos: string;
  clase: string;
  recursos: string;
  // B) Aspectos curriculares
  contenidos: string;
  tp: string;
  tpLab: string;
  tpCampo: string;
  evaluacion: string;
  regimen: string;
  horarios: string;
  distribucion: string;
}

/** Datos de firma que acompañan a cada informe emitido. */
interface FirmaInforme {
  modelo: 'ORD_219_2022';
  observaciones: string;
  firmante: string;
  /** Fecha de emisión ya formateada (es-AR). */
  fecha: string;
}

/** JSON guardado en `Planificacion.informePedagogico` (dictamen compatible con el formato anterior). */
export interface InformePedagogicoGuardado extends FirmaInforme {
  dictamen: 'FAVORABLE' | 'REQUIERE_CORRECCION';
  pedagogico: InformePedagogicoDatos;
}

/** JSON guardado en `Planificacion.informeDisciplinar` (dictamen compatible con el formato anterior). */
export interface InformeDisciplinarGuardado extends FirmaInforme {
  dictamen: 'CUMPLE' | 'REQUIERE_CORRECCION';
  disciplinar: InformeDisciplinarDatos;
}

/** Encabezado institucional de ambos anexos. */
export interface EncabezadoInforme {
  sede: string;
  carrera: string;
  plan: string;
  anio: string;
  asignatura: string;
  anioCursada: string;
  regimen: string;
  cargaHoraria: string;
}

export interface IntegranteInforme {
  docenteId: string;
  nombre: string;
  cargo: string;
}

/** Todo lo que necesita la vista/hoja de informes de un PAAC (serializable, se arma en el servidor). */
export interface ContextoInformes {
  encabezado: EncabezadoInforme;
  ciclo: number;
  equipo: IntegranteInforme[];
  pedApproved: boolean;
  discApproved: boolean;
  /** Informe guardado normalizado al modelo oficial (o autocompletado si es del formato anterior). */
  pedagogico: { datos: InformePedagogicoDatos; obs: string; firmante?: string; fecha?: string } | null;
  disciplinar: { datos: InformeDisciplinarDatos; obs: string; firmante?: string; fecha?: string } | null;
}
