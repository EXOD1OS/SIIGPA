// Autocompletado de los informes del PAAC (Ord. HCS N° 219/2022, Anexos III y IV) a partir del contenido
// real cargado por la cátedra (`Planificacion.datosPaac`, variantes Tradicional y Por Competencias),
// el contexto de la asignatura y el estado de los PaadAnual del equipo.
import type { PaacCompetenciasData, PaacTraditionalData } from '@/types/planificacion';
import type {
  ContextoInformes,
  EncabezadoInforme,
  InformeDisciplinarDatos,
  InformeDisciplinarGuardado,
  InformePedagogicoDatos,
  InformePedagogicoGuardado,
  IntegranteInforme,
} from '@/types/informes';

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const hay = (v: unknown) => txt(v) !== '';
const lista = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
const NO_SE_PREVE = /no se prev|no corresponde|no aplica/i;

export const REGIMEN_LABEL: Record<string, string> = { ANUAL: 'Anual', '1C': '1º Cuatrimestre', '2C': '2º Cuatrimestre' };

/** "A", "A y B", "A, B y C". */
export function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

export function esCompetencias(d: unknown): d is PaacCompetenciasData {
  return !!d && typeof d === 'object' && 'objetivosPropositoRA' in d;
}

/** Vista uniforme de lo que miran los informes, sin importar la variante del PAAC. */
function analizar(datos: unknown) {
  if (esCompetencias(datos)) {
    const d = datos;
    const tps = lista(d.programaTrabajosPracticos);
    const modalidades = tps.map((t) => txt(t.modalidad).toLowerCase());
    const reg = d.evaluacion?.regimenAprobacion ?? { promocional: '', regular: '', libre: '' };
    return {
      introduccion: [hay(d.fundamentacion?.importanciaAsignatura), lista(d.fundamentacion?.matrizCompetencias).length > 0],
      diagnostico: Object.values(d.fundamentacion?.diagnostico ?? {}).filter(hay).length,
      diagnosticoTotal: 4,
      objetivos: hay(d.objetivosPropositoRA?.objetivosCarrera) || lista(d.objetivosPropositoRA?.propositoAsignatura).some(hay) || lista(d.objetivosPropositoRA?.resultadosAprendizaje).length > 0,
      metodologia: hay(d.metodologia?.enfoque),
      recursos: lista(d.metodologia?.propuestaDesarrolloCompetencias).length > 0,
      unidades: lista(d.contenidos).length,
      tps: tps.length > 0,
      laboratorio: modalidades.some((m) => m.includes('lab')),
      campo: modalidades.some((m) => m.includes('campo')),
      tiposEval: lista(d.evaluacion?.tipos),
      evalCompleta: lista(d.evaluacion?.criterios).some(hay) && lista(d.evaluacion?.tipos).length > 0,
      regimen: reg,
      horarios: lista(d.horariosClases).some((h) => hay(h.horasTeoricas) || hay(h.horasPracticas)),
      distribucion: lista(d.cronograma).length > 0,
      bibBasica: lista(d.bibliografia?.basica).length,
      bibComplementaria: lista(d.bibliografia?.complementaria).length,
    };
  }
  const d = (datos ?? {}) as Partial<PaacTraditionalData>;
  const lab = txt(d.trabajosPracticos?.laboratorio);
  const campo = d.trabajosPracticos?.trabajoCampo;
  const reg = d.metodologiaEvaluacion?.regimenAprobacion ?? { promocional: '', regular: '', libre: '' };
  const cronograma = txt(d.distribucionHoraria?.cronograma);
  return {
    introduccion: [hay(d.fundamentacion?.introduccion?.importancia), hay(d.fundamentacion?.introduccion?.relacionPerfil)],
    diagnostico: Object.values(d.fundamentacion?.diagnostico ?? {}).filter(hay).length,
    diagnosticoTotal: 3,
    objetivos:
      lista(d.objetivos?.especificos).some(hay) ||
      Object.values(d.objetivos?.catedra ?? {}).some((l) => lista(l as string[]).some(hay)),
    metodologia: hay(d.metodologiaEnsenanza?.clasesTeoricas) || hay(d.metodologiaEnsenanza?.clasesPracticas),
    recursos: lista(d.metodologiaEnsenanza?.recursosDidacticos).some(hay),
    // La variante tradicional no separa unidades: los contenidos se desarrollan en el cronograma.
    unidades: cronograma ? -1 : 0,
    tps: hay(d.trabajosPracticos?.detalleTp),
    laboratorio: !!lab && !NO_SE_PREVE.test(lab),
    campo: !!campo && (hay(campo.objetivos) || hay(campo.lugar) || (campo.horas ?? 0) > 0),
    tiposEval: lista(d.metodologiaEvaluacion?.tipos),
    evalCompleta: hay(d.metodologiaEvaluacion?.criterios) && lista(d.metodologiaEvaluacion?.tipos).length > 0,
    regimen: reg,
    horarios: (d.distribucionHoraria?.horasSemanales ?? 0) > 0,
    distribucion: !!cronograma || (d.distribucionHoraria?.horasTotales ?? 0) > 0,
    bibBasica: lista(d.bibliografia?.basica).length,
    bibComplementaria: lista(d.bibliografia?.complementaria).length,
  };
}

/** Anexo IV — sugerencia de la Dirección de Carrera a partir del PAAC y de los PAAD del equipo. */
export function sugerirInformeDisciplinar(datosPaac: unknown, paads: (IntegranteInforme & { presento: boolean })[]): InformeDisciplinarDatos {
  const a = analizar(datosPaac);
  return {
    contenidos: a.unidades !== 0 ? 'Cumple' : 'No Cumple',
    tp: a.tps ? 'Acorde' : 'No Acorde',
    tpLab: a.laboratorio ? 'Acorde' : 'No corresponde',
    tpCampo: a.campo ? 'Acorde' : 'No corresponde',
    bibBasica: a.bibBasica > 0 ? 'Presenta' : 'No Presenta',
    bibComplementaria: a.bibComplementaria > 0 ? 'Presenta' : 'No Presenta',
    paads: paads.map(({ presento, ...i }) => ({ ...i, valor: presento ? 'Presentó' : 'No Presentó' })),
  };
}

/** Anexo III — sugerencia de la UAP a partir del PAAC. */
export function sugerirInformePedagogico(datosPaac: unknown): InformePedagogicoDatos {
  const a = analizar(datosPaac);
  const [intro, perfil] = a.introduccion;
  const introduccion =
    intro && perfil
      ? { valor: 'Presenta Completa', texto: 'Fundamenta la importancia de la asignatura y su relación con el perfil de egreso.' }
      : intro || perfil
        ? { valor: 'Presenta Parcialmente', texto: intro ? 'Falta precisar la relación con el perfil o las competencias de egreso.' : 'Falta fundamentar la importancia de la asignatura.' }
        : { valor: 'No Presenta', texto: '' };
  const diagnostico =
    a.diagnostico >= a.diagnosticoTotal
      ? { valor: 'Presenta Completa', texto: 'Describe la articulación vertical y horizontal y la infraestructura requerida.' }
      : a.diagnostico > 0
        ? { valor: 'Presenta Parcialmente', texto: `Completa ${a.diagnostico} de los ${a.diagnosticoTotal} aspectos del diagnóstico.` }
        : { valor: 'No Presenta', texto: '' };

  const regimenes = [hay(a.regimen.promocional) && 'Promocional', hay(a.regimen.regular) && 'Regular', hay(a.regimen.libre) && 'Libre'].filter(
    (x): x is string => !!x,
  );
  const soloSumativa = a.tiposEval.length === 1 && a.tiposEval[0] === 'FINAL';

  return {
    introduccion,
    diagnostico,
    objetivos: a.objetivos ? 'Concretos y claros' : 'No presenta',
    clase: a.metodologia ? 'Presenta y describe la metodología del proceso de enseñanza' : 'No presenta',
    recursos: a.recursos ? 'Presenta recursos didácticos acordes a las estrategias' : a.metodologia ? 'Recursos didácticos a precisar' : 'No presenta',
    contenidos: a.unidades > 0 ? `Desarrollados en ${a.unidades} unidades` : a.unidades < 0 ? 'Desarrollados en el cronograma de la asignatura' : 'No presenta',
    tp: a.tps ? 'Articulados con la teoría' : 'No presenta',
    tpLab: a.laboratorio ? 'Articulados con la teoría' : 'No corresponde',
    tpCampo: a.campo ? 'Articulados con la teoría' : 'No corresponde',
    evaluacion: a.evalCompleta
      ? soloSumativa
        ? 'Solo sumativa. Criterios a precisar'
        : 'Formativa y Sumativa. Criterios claros. Técnicas de evaluación apropiadas'
      : 'No presenta',
    regimen: regimenes.length ? enumerar(regimenes) : 'No presenta',
    horarios: a.horarios ? 'Presenta' : 'No Presenta',
    distribucion: a.distribucion ? 'Presenta' : 'No Presenta',
  };
}

/** Síntesis inicial de la observación cuando el área no dejó observaciones abiertas. */
export function observacionSugerida(area: 'uap' | 'direccion', abiertas: number): string {
  if (abiertas > 0) return '';
  return area === 'direccion'
    ? 'Sin observaciones. El PAAC se ajusta a los contenidos mínimos del plan de estudio.'
    : 'Sin observaciones. La propuesta pedagógica es coherente con el perfil de egreso.';
}

/** Cargo abreviado como en los modelos impresos. */
export function cargoLegible(cargo: string, esResponsable: boolean) {
  const base: Record<string, string> = {
    TITULAR: 'Prof. Titular',
    ASOCIADO: 'Prof. Asociado',
    ADJUNTO: 'Prof. Adjunto',
    JTP: 'Prof. JTP',
    AYUDANTE: 'Ayudante',
  };
  const c = base[cargo] ?? cargo;
  return esResponsable ? `${c} / Responsable` : c;
}

export function encabezadoInforme(p: {
  sede: string;
  carrera: string;
  plan: string;
  ciclo: number;
  asignatura: string;
  anoCursada: number;
  regimen: string;
  creditoHorario: number;
}): EncabezadoInforme {
  return {
    sede: p.sede,
    carrera: p.carrera,
    plan: p.plan,
    anio: String(p.ciclo),
    asignatura: p.asignatura,
    anioCursada: `${p.anoCursada}º Año`,
    regimen: REGIMEN_LABEL[p.regimen] ?? p.regimen,
    cargaHoraria: `${p.creditoHorario} HS`,
  };
}

const esGuardadoPed = (v: unknown): v is InformePedagogicoGuardado => !!v && typeof v === 'object' && 'pedagogico' in v;
const esGuardadoDisc = (v: unknown): v is InformeDisciplinarGuardado => !!v && typeof v === 'object' && 'disciplinar' in v;
const obsLegada = (v: unknown) => (v && typeof v === 'object' ? txt((v as { observaciones?: unknown }).observaciones) : '');

/**
 * Normaliza los informes guardados al modelo oficial. Un informe anterior al modelo (formato por enums)
 * se muestra con el autocompletado del PAAC y su observación original.
 */
export function contextoInformes(opts: {
  encabezado: EncabezadoInforme;
  ciclo: number;
  equipo: (IntegranteInforme & { presento: boolean })[];
  datosPaac: unknown;
  informePedagogico: unknown;
  informeDisciplinar: unknown;
  pedApproved: boolean;
  discApproved: boolean;
}): ContextoInformes {
  const { informePedagogico: ip, informeDisciplinar: id } = opts;
  return {
    encabezado: opts.encabezado,
    ciclo: opts.ciclo,
    equipo: opts.equipo.map(({ presento: _p, ...i }) => i),
    pedApproved: opts.pedApproved,
    discApproved: opts.discApproved,
    pedagogico: esGuardadoPed(ip)
      ? { datos: ip.pedagogico, obs: ip.observaciones, firmante: ip.firmante, fecha: ip.fecha }
      : ip
        ? { datos: sugerirInformePedagogico(opts.datosPaac), obs: obsLegada(ip) }
        : null,
    disciplinar: esGuardadoDisc(id)
      ? { datos: id.disciplinar, obs: id.observaciones, firmante: id.firmante, fecha: id.fecha }
      : id
        ? { datos: sugerirInformeDisciplinar(opts.datosPaac, opts.equipo), obs: obsLegada(id) }
        : null,
  };
}
