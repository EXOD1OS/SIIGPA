// Adaptador bidireccional entre Prisma y los componentes literales del prototipo (`src/prototipo/`).
// Módulo puro (sin Prisma): lo usan tanto el servidor (armado de datos) como los contenedores cliente.
//
// - `datosPaac` / `datosPaad` guardan el JSON completo del prototipo (PaacContenido / PaadContenido).
//   Los registros con el esquema anterior (Tradicional / Por Competencias / PaadData) se convierten al leer
//   y quedan guardados en el formato nuevo con el próximo guardado.
// - Las observaciones se anclan como `campoPath = "<paac|paad>.<fKey>::<sección>"`.
// - Los informes se guardan con el modelo de `types/informes.ts` (dictamen FAVORABLE/CUMPLE compatible) y se
//   exponen como `InformeEvaluacion` del prototipo.
import { escaparHtml, parrafo } from '@/prototipo/lib/richText';
import { COMPETENCIAS_GENERALES, nuevoId, paacVacio, semanaVacia, type NivelAporte, type PaacContenido } from '@/prototipo/types/paac';
import { ACTIVIDADES_PAAD, DIAS_PAAD, paadVacio, type ActividadPaad, type PaadContenido } from '@/prototipo/types/paad';
import type { Asignatura, AsigContext, Carrera, Departamento, EquipoCatedra, PlanEstudio, Regimen, Sede, Usuario } from '@/prototipo/types/estructura';
import type { EstadoPlanif, InformeEvaluacion, ObservacionDoc, PaacDoc } from '@/prototipo/types/planificacion';
import type { PaacCompetenciasData, PaacTraditionalData, PaadData } from '@/types/planificacion';

// ---------------------------------------------------------------------------
// Detección de formato
// ---------------------------------------------------------------------------

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** El JSON ya está en el esquema del prototipo (PaacContenido). */
export function esPaacPrototipo(v: unknown): v is PaacContenido {
  return esObjeto(v) && 'competenciasGenerales' in v && Array.isArray(v.unidades) && Array.isArray(v.cronograma) && esObjeto(v.bibliografia);
}

/** El JSON ya está en el esquema del prototipo (PaadContenido). */
export function esPaadPrototipo(v: unknown): v is PaadContenido {
  return esObjeto(v) && esObjeto(v.listas) && esObjeto(v.horas);
}

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const lista = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
const ul = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${escaparHtml(i)}</li>`).join('')}</ul>` : '');
const unir = (...p: (string | number | undefined | null)[]) => p.map((x) => (x == null ? '' : String(x).trim())).filter(Boolean).join(' – ');

/** Completa con los valores por defecto los campos que falten (JSON guardado por versiones previas del editor). */
function completarPaac(v: PaacContenido): PaacContenido {
  const base = paacVacio();
  return {
    ...base,
    ...v,
    competenciasGenerales: { ...base.competenciasGenerales, ...(v.competenciasGenerales ?? {}) },
    diagnostico: { ...base.diagnostico, ...(v.diagnostico ?? {}) },
    regimen: { ...base.regimen, ...(v.regimen ?? {}) },
    bibliografia: {
      basica: { ...base.bibliografia.basica, ...(v.bibliografia?.basica ?? {}) },
      complementaria: { ...base.bibliografia.complementaria, ...(v.bibliografia?.complementaria ?? {}) },
    },
    horarios: { teoricas: { ...base.horarios.teoricas, ...(v.horarios?.teoricas ?? {}) }, practicas: { ...base.horarios.practicas, ...(v.horarios?.practicas ?? {}) } },
  };
}

// ---------------------------------------------------------------------------
// PAAC: esquema anterior → PaacContenido
// ---------------------------------------------------------------------------

function desdeTradicional(d: Partial<PaacTraditionalData>): PaacContenido {
  const c = paacVacio();
  const cat = d.objetivos?.catedra;
  const objetivos = [
    ...lista(cat?.conceptuales).map((o) => `Conceptual: ${o}`),
    ...lista(cat?.procedimentales).map((o) => `Procedimental: ${o}`),
    ...lista(cat?.actitudinales).map((o) => `Actitudinal: ${o}`),
    ...lista(d.objetivos?.especificos).map((o) => `Específico: ${o}`),
  ].filter((o) => o.split(': ')[1]?.trim());
  const campo = d.trabajosPracticos?.trabajoCampo;
  const ev = d.metodologiaEvaluacion;
  const libro = (b: { autor: string; titulo: string; ano: number; editorial: string }) => ({
    id: nuevoId('bf'),
    titulo: b.titulo ?? '',
    autores: b.autor ?? '',
    editorial: b.editorial ?? '',
    ejemplares: '',
    anio: b.ano ? String(b.ano) : '',
  });
  return {
    ...c,
    importancia: parrafo(txt(d.fundamentacion?.introduccion?.importancia)) + parrafo(txt(d.fundamentacion?.introduccion?.relacionPerfil)),
    diagnostico: {
      correlativas: parrafo(txt(d.fundamentacion?.diagnostico?.articulacionCorrelativas)),
      mismoAnio: parrafo(txt(d.fundamentacion?.diagnostico?.articulacionMismoAno)),
      estudiantes: '',
      infraestructura: parrafo(txt(d.fundamentacion?.diagnostico?.infraestructura)),
    },
    proposito: ul(objetivos),
    metodologia:
      parrafo(txt(d.metodologiaEnsenanza?.clasesTeoricas)) + parrafo(txt(d.metodologiaEnsenanza?.clasesPracticas)) + ul(lista(d.metodologiaEnsenanza?.recursosDidacticos).filter((r) => r.trim())),
    tpIntro:
      parrafo(txt(d.trabajosPracticos?.detalleTp)) +
      parrafo(txt(d.trabajosPracticos?.laboratorio)) +
      (campo && (campo.objetivos || campo.lugar) ? parrafo(unir('Trabajo de campo', campo.objetivos, campo.lugar, campo.horas ? `${campo.horas} hs` : '')) : ''),
    evalDescripcion: parrafo(txt(ev?.criterios)) + (lista(ev?.modalidades).length ? parrafo(`Modalidades: ${lista(ev?.modalidades).join(', ').replaceAll('_', ' ').toLowerCase()}.`) : ''),
    evaluacion: lista(ev?.tipos).map((t) => ({ id: nuevoId('ev'), tipo: t === 'FINAL' ? 'Sumativa' : 'Formativa', criterios: '', ra: '', tecnica: t === 'INICIAL' ? 'Evaluación inicial' : t === 'DE_PROCESO' ? 'Evaluación de proceso' : 'Evaluación final' })),
    regimen: { promocionales: parrafo(txt(ev?.regimenAprobacion?.promocional)), regulares: parrafo(txt(ev?.regimenAprobacion?.regular)), libres: parrafo(txt(ev?.regimenAprobacion?.libre)) },
    bibliografia: {
      basica: { fisica: lista(d.bibliografia?.basica).map(libro), digital: [] },
      complementaria: { fisica: lista(d.bibliografia?.complementaria).map(libro), digital: [] },
    },
    notasCronograma: parrafo(txt(d.distribucionHoraria?.cronograma)),
  };
}

function desdeCompetencias(d: Partial<PaacCompetenciasData>): PaacContenido {
  const c = paacVacio();
  const matriz = lista(d.fundamentacion?.matrizCompetencias);
  const nivel = (n: unknown): NivelAporte | null => ([0, 1, 2, 3].includes(Number(n)) ? (Number(n) as NivelAporte) : null);
  const generales = { ...c.competenciasGenerales };
  for (const m of matriz) if (COMPETENCIAS_GENERALES.some((g) => g.codigo === m.codigo)) generales[m.codigo] = nivel(m.nivelAporte);
  const libro = (b: { titulo: string; autores: string; editorial: string; enlace?: string; ano: number }) =>
    b.enlace && /^https?:\/\//.test(b.enlace)
      ? { tipo: 'digital' as const, item: { id: nuevoId('bd'), titulo: b.titulo ?? '', autores: b.autores ?? '', editorial: b.editorial ?? '', url: b.enlace, anio: b.ano ? String(b.ano) : '' } }
      : { tipo: 'fisica' as const, item: { id: nuevoId('bf'), titulo: b.titulo ?? '', autores: b.autores ?? '', editorial: b.editorial ?? '', ejemplares: '', anio: b.ano ? String(b.ano) : '' } };
  const bloque = (l: Parameters<typeof libro>[0][]) => {
    const r = lista(l).map(libro);
    return { fisica: r.flatMap((x) => (x.tipo === 'fisica' ? [x.item] : [])), digital: r.flatMap((x) => (x.tipo === 'digital' ? [x.item] : [])) };
  };
  const horarios = { ...c.horarios, teoricas: { ...c.horarios.teoricas }, practicas: { ...c.horarios.practicas } };
  for (const h of lista(d.horariosClases)) {
    const dia = h.dia?.toLowerCase() as keyof typeof horarios.teoricas;
    if (dia in horarios.teoricas) {
      horarios.teoricas[dia] = h.horasTeoricas ?? '';
      horarios.practicas[dia] = h.horasPracticas ?? '';
    }
  }
  const ev = d.evaluacion;
  return {
    ...c,
    nivelIntensidad: d.encabezado?.nivelIntensidad ? String(d.encabezado.nivelIntensidad) : '',
    relacionTP: txt(d.encabezado?.relacionTeoricoPractica),
    importancia: parrafo(txt(d.fundamentacion?.importanciaAsignatura)),
    competenciasGenerales: generales,
    competenciasEspecificas: matriz.filter((m) => m.tipo === 'ESPECIFICA').map((m) => ({ id: nuevoId('ce'), codigo: m.codigo ?? '', detalle: m.detalle ?? '', nivel: nivel(m.nivelAporte) })),
    diagnostico: {
      correlativas: parrafo(txt(d.fundamentacion?.diagnostico?.articulacionCorrelativas)),
      mismoAnio: parrafo(txt(d.fundamentacion?.diagnostico?.articulacionMismoAno)),
      estudiantes: parrafo(txt(d.fundamentacion?.diagnostico?.analisisEstudiantes)),
      infraestructura: parrafo(txt(d.fundamentacion?.diagnostico?.infraestructuraRequerida)),
    },
    objetivosCarrera: parrafo(txt(d.objetivosPropositoRA?.objetivosCarrera)),
    proposito: ul(lista(d.objetivosPropositoRA?.propositoAsignatura).filter((p) => p.trim())),
    resultados: lista(d.objetivosPropositoRA?.resultadosAprendizaje).map((r) => ({ id: nuevoId('ra'), codigo: r.codigo ?? '', descripcion: r.detalle ?? '' })),
    metodologia: parrafo(txt(d.metodologia?.enfoque)),
    propuesta: lista(d.metodologia?.propuestaDesarrolloCompetencias).map((p) => ({
      id: nuevoId('pr'),
      competencia: p.competencia ?? '',
      ra: p.resultadoAprendizaje ?? '',
      unidades: p.unidadTema ?? '',
      guiaTp: p.guiaTp ?? '',
      actividad: p.actividadFormativa ?? '',
      estrategia: p.estrategiaEnsenanza ?? '',
    })),
    unidades: lista(d.contenidos).map((u) => ({ id: nuevoId('un'), numero: String(u.unidad ?? ''), titulo: u.titulo ?? '', contenidos: parrafo(txt(u.detalle)), resultados: '' })),
    trabajosPracticos: lista(d.programaTrabajosPracticos).map((t) => ({
      id: nuevoId('tp'),
      numero: String(t.numero ?? ''),
      titulo: t.titulo ?? '',
      proposito: lista(t.proposito).join('\n'),
      modalidad: t.modalidad ?? '',
      unidadTemas: t.unidadTemas ?? '',
    })),
    evalDescripcion: ul(lista(ev?.criterios).filter((x) => x.trim())),
    evaluacion: lista(ev?.tecnicas)
      .filter((t) => t.trim())
      .map((t) => ({ id: nuevoId('ev'), tipo: 'Formativa / Sumativa', criterios: '', ra: '', tecnica: t })),
    regimen: { promocionales: parrafo(txt(ev?.regimenAprobacion?.promocional)), regulares: parrafo(txt(ev?.regimenAprobacion?.regular)), libres: parrafo(txt(ev?.regimenAprobacion?.libre)) },
    bibliografia: { basica: bloque(lista(d.bibliografia?.basica)), complementaria: bloque(lista(d.bibliografia?.complementaria)) },
    horarios,
    cronograma: lista(d.cronograma).map((s, i) => ({
      ...semanaVacia(i + 1),
      semana: String(s.semana ?? i + 1),
      unidad: s.unidad != null ? String(s.unidad) : '',
      horasTeoria: s.horasTeoricas != null ? String(s.horasTeoricas) : '',
      tp: s.tpNumero != null ? String(s.tpNumero) : '',
      horasPractica: s.horasPracticas != null ? String(s.horasPracticas) : '',
      evaluacion: s.evaluacion ?? '',
    })),
  };
}

/** Contenido del PAAC listo para `PaacEditor` (convierte el esquema anterior si hace falta). */
export function paacDesdeDb(datos: unknown): PaacContenido {
  if (esPaacPrototipo(datos)) return completarPaac(datos);
  if (esObjeto(datos) && 'objetivosPropositoRA' in datos) return desdeCompetencias(datos as Partial<PaacCompetenciasData>);
  if (esObjeto(datos) && ('fundamentacion' in datos || 'metodologiaEnsenanza' in datos)) return desdeTradicional(datos as Partial<PaacTraditionalData>);
  return paacVacio();
}

// ---------------------------------------------------------------------------
// PAAD: esquema anterior → PaadContenido
// ---------------------------------------------------------------------------

const ACTIVIDAD_DESDE_DB: Record<string, ActividadPaad> = {
  ENSENANZA: 'ensenanza',
  INVESTIGACION: 'investigacion',
  EXTENSION: 'extension',
  FORMACION: 'formacion',
  GESTION: 'gestion',
};
const lineas = (t: string | undefined) => (t ?? '').split(/\n+/).map((x) => x.trim()).filter(Boolean);

/** Contenido del PAAD listo para `PaadEditor` (convierte el PaadData anterior si hace falta). */
export function paadDesdeDb(datos: unknown): PaadContenido {
  const base = paadVacio();
  if (esPaadPrototipo(datos)) {
    const horas = { ...base.horas };
    for (const a of ACTIVIDADES_PAAD) horas[a] = { ...base.horas[a], ...(datos.horas?.[a] ?? {}) };
    return { listas: { ...base.listas, ...datos.listas }, horas };
  }
  if (!esObjeto(datos) || !('actividadEnsenanza' in datos)) return base;
  const d = datos as unknown as PaadData;
  const ae = d.actividadEnsenanza;
  const horas = { ...base.horas };
  for (const fila of lista(d.distribucionHoraria)) {
    const a = ACTIVIDAD_DESDE_DB[fila.actividad];
    if (!a) continue;
    horas[a] = { ...horas[a] };
    for (const dia of DIAS_PAAD) horas[a][dia] = (fila as Record<string, string | undefined>)[dia] ?? '';
  }
  const limpia = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
  return {
    listas: {
      cursos: limpia(lista(ae?.cursosAtendidos)),
      capacitaciones: limpia(lista(ae?.capacitaciones).map((c) => unir(c.nombreCapacitacion, c.lugar, c.fecha, c.tematica, c.areaConocimiento))),
      materiales: limpia(lista(ae?.materialElaborado).map((m) => unir(m.areaConocimiento, m.tipo, m.autores, m.fecha))),
      otrosDocentes: limpia(lista(ae?.otrosTrabajosDocentes).map((o) => unir(o.areaTematica, o.lugar, o.fecha, o.destinatarios, o.nivel))),
      investigacion: limpia(lista(d.investigacion).map((i) => unir(i.proyecto, i.descripcion, i.cargo, i.numeroResolucion && `Res. ${i.numeroResolucion}`, i.etapa))),
      recursosHumanos: lineas(d.formacionRecursosHumanos?.detalle),
      formacionAcademica: lineas(d.formacionAcademica?.detalle),
      extension: limpia(lista(d.extension).map((e) => unir(e.proyecto, e.destinatarios, e.tiempoLugar, e.alumnosInvolucrados, e.informe))),
      gestion: lineas(d.gestion?.detalle),
      otras: limpia(lista(d.otrasActividades)),
    },
    horas,
  };
}

// ---------------------------------------------------------------------------
// Observaciones
// ---------------------------------------------------------------------------

/** Ancla de una observación nueva (campo + apartado), en el `campoPath` de Prisma. */
export const anclaObservacion = (path: string, seccion: number) => `${path}::${seccion}`;

export interface ObservacionDb {
  id: string;
  campoPath: string;
  mensaje: string;
  resuelto: boolean;
  rolAutor: string;
  createdAt: Date | string;
  autor?: { nombre: string; apellido: string } | null;
}

/** `ItemObservacion` / `ObservacionPaad` → `ObservacionDoc`. Las anteriores al editor quedan sin `field`. */
export function observacionDoc(o: ObservacionDb, prefijo: 'paac' | 'paad'): ObservacionDoc {
  const [path, sec] = o.campoPath.split('::');
  const field = path.startsWith(`${prefijo}.`) && sec !== undefined ? path.slice(prefijo.length + 1) : undefined;
  const fecha = new Date(o.createdAt);
  return {
    id: o.id,
    resolved: o.resuelto,
    field,
    campoPath: path,
    section: sec !== undefined && Number.isFinite(Number(sec)) ? Number(sec) : undefined,
    area: o.rolAutor === 'DIRECCION_CARRERA' ? 'direccion' : 'uap',
    author: o.autor ? `${o.autor.nombre} ${o.autor.apellido}` : undefined,
    text: o.mensaje,
    date: Number.isNaN(fecha.getTime()) ? undefined : fecha.toLocaleDateString('es-AR'),
  };
}

// ---------------------------------------------------------------------------
// Informes (Ord. 219/22)
// ---------------------------------------------------------------------------

/** JSON de `informePedagogico` / `informeDisciplinar` → `InformeEvaluacion` del prototipo. */
export function informeDesdeDb(v: unknown, area: 'uap' | 'direccion'): InformeEvaluacion {
  if (!esObjeto(v)) return { items: {} };
  const dictamen = txt(v.dictamen);
  const obs = txt(v.observaciones);
  const inf: InformeEvaluacion = {
    items: {},
    dictamen: dictamen === 'FAVORABLE' || dictamen === 'CUMPLE' ? 'APROBADO' : dictamen === 'REQUIERE_CORRECCION' ? 'OBSERVADO' : dictamen === 'REEVALUACION' ? 'REEVALUACION' : undefined,
    by: txt(v.firmante) || undefined,
    fecha: txt(v.fecha) || undefined,
  };
  if (area === 'uap') {
    inf.obsGenerales = obs;
    if (esObjeto(v.pedagogico)) inf.pedagogico = v.pedagogico as unknown as InformeEvaluacion['pedagogico'];
  } else {
    inf.obsDisciplinares = obs;
    if (esObjeto(v.disciplinar)) inf.disciplinar = v.disciplinar as unknown as InformeEvaluacion['disciplinar'];
  }
  return inf;
}

// ---------------------------------------------------------------------------
// Estructura académica serializable → AsigContext / EquipoCatedra / Usuario
// ---------------------------------------------------------------------------

/** Cargo real (enum de Prisma) → cargo del catálogo del prototipo. */
export const CARGO_PROTOTIPO: Record<string, string> = {
  TITULAR: 'Profesor Titular',
  ASOCIADO: 'Profesor Asociado',
  ADJUNTO: 'Profesor Adjunto',
  JTP: 'Jefe de Trabajos Prácticos',
  AYUDANTE: 'Ayudante de Primera',
};

/** Todo lo que necesitan los componentes del prototipo para resolver asignaturas, equipos y nombres. */
export interface EstructuraPrototipo {
  ciclo: number;
  sedes: Sede[];
  departamentos: Departamento[];
  carreras: Carrera[];
  planes: PlanEstudio[];
  asignaturas: Asignatura[];
  usuarios: Usuario[];
  equipos: EquipoCatedra[];
}

export function crearContexto(E: EstructuraPrototipo) {
  const asigBy = new Map(E.asignaturas.map((a) => [a.id, a]));
  const planBy = new Map(E.planes.map((p) => [p.id, p]));
  const carBy = new Map(E.carreras.map((c) => [c.id, c]));
  const sedeBy = new Map(E.sedes.map((s) => [s.id, s]));
  const depBy = new Map(E.departamentos.map((d) => [d.id, d]));
  const userBy = new Map(E.usuarios.map((u) => [u.id, u]));
  const asigContext = (id: string): AsigContext => {
    const asig = asigBy.get(id);
    const plan = asig ? planBy.get(asig.planEstudioId) : undefined;
    const carrera = plan ? carBy.get(plan.carreraId) : undefined;
    return {
      asig,
      plan,
      carrera,
      sede: carrera ? sedeBy.get(carrera.sedeId) : undefined,
      depto: carrera?.departamentoId ? (depBy.get(carrera.departamentoId) ?? null) : null,
      radicacion: asig?.departamentoRadicacionId ? (depBy.get(asig.departamentoRadicacionId) ?? null) : null,
    };
  };
  const fullName = (id: string) => {
    const u = userBy.get(id);
    return u ? `${u.nombre} ${u.apellido}` : '—';
  };
  const equipoDeAsig = (id: string) => E.equipos.filter((e) => e.asignaturaId === id && e.cicloLectivo === E.ciclo);
  return { asigContext, fullName, equipoDeAsig };
}

/** Régimen de Prisma → régimen del prototipo. */
export const regimenPrototipo = (r: string): Regimen => (r === '1C' || r === '2C' ? r : 'ANUAL');

/** Documento PAAC del prototipo a partir de los datos ya resueltos de una planificación. */
export function paacDoc(p: {
  id: string;
  asignaturaId: string;
  responsableId: string;
  ciclo: number;
  regimen: string;
  estado: string;
  datosPaac: unknown;
  informePedagogico: unknown;
  informeDisciplinar: unknown;
  pedApproved: boolean;
  discApproved: boolean;
  expediente: string | null;
  resolucion: string | null;
  fechaElevacion: string | null;
  fechaResolucion: string | null;
  comments: ObservacionDoc[];
}): PaacDoc {
  return {
    id: p.id,
    type: 'PAAC',
    asignaturaId: p.asignaturaId,
    owner: p.responsableId,
    cycle: p.ciclo,
    periodo: p.regimen === '2C' ? '2C' : '1C',
    state: p.estado as EstadoPlanif,
    pedApproved: p.pedApproved,
    discApproved: p.discApproved,
    expediente: p.expediente ?? '',
    resolucion: p.resolucion ?? '',
    fechaElevacion: p.fechaElevacion ?? undefined,
    fechaResolucion: p.fechaResolucion ?? undefined,
    data: {},
    paac: paacDesdeDb(p.datosPaac),
    pedReport: informeDesdeDb(p.informePedagogico, 'uap'),
    discReport: informeDesdeDb(p.informeDisciplinar, 'direccion'),
    comments: p.comments,
  };
}
