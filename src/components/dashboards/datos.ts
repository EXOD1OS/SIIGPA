// Datos y navegación comunes a los dashboards de Inicio (serializables: se arman en el servidor con Prisma).
import type { Dictamen } from '@/types/planificacion';

export const COLOR = {
  aprobado: '#10b981',
  revision: '#3b82f6',
  observado: '#f59e0b',
  pendiente: '#64748b',
  elevado: '#8b5cf6',
  pleno: '#14b8a6',
} as const;

export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
export const contar = <T,>(lista: T[], pred: (x: T) => boolean) => lista.filter(pred).length;

export interface ObsResumen {
  id: string;
  resolved: boolean;
  area?: 'uap' | 'direccion';
  campoPath?: string;
  text: string;
}

export interface CarreraResumen {
  id: string;
  sigla: string;
  nombre: string;
}

/** PAAC (Planificacion) tal como lo necesitan los dashboards. */
export interface PaacResumen {
  id: string;
  asignatura: string;
  /** Carrera del plan de estudios. */
  carreraId: string;
  carreraSigla: string;
  /** Carrera cuya Dirección evalúa la asignatura (propia o delegada). */
  evalCarreraId: string;
  ordenanza: string;
  regimen: string;
  cycle: number;
  state: string;
  responsableId: string;
  responsable: string;
  /** Integrantes del equipo con su cargo en la cátedra. */
  equipo: { docenteId: string; cargo: string }[];
  pedApproved: boolean;
  discApproved: boolean;
  ped: Dictamen;
  disc: Dictamen;
  avance: number;
  expediente: string | null;
  resolucion: string | null;
  comments: ObsResumen[];
}

/** PAAD anual (los estados históricos APROBADO_UAP / APROBADO_DIRECCION llegan normalizados a APROBADO). */
export interface PaadResumen {
  id: string;
  owner: string;
  ownerName: string;
  state: string;
  cycle: number;
  evalCareer: string | null;
  comments: ObsResumen[];
  progreso: { completados: number; total: number; pct: number };
}

export interface DatosDashboard {
  uid: string;
  nombre: string;
  ciclo: number;
  paacs: PaacResumen[];
  paads: PaadResumen[];
  carreras: CarreraResumen[];
  /** Dirección: asignaturas de cada carrera y cuántas tienen Docente Responsable designado en el ciclo. */
  cobertura: Record<string, { asignaturas: number; cubiertas: number }>;
}

export interface FiltrosPaac {
  careerId?: string;
  state?: string;
  regimen?: string;
  search?: string;
  ciclo?: number;
  vista?: 'activas' | 'historicas';
}

export interface FiltrosPaad {
  careerId?: string;
  state?: string;
  search?: string;
  ciclo?: number;
}

export interface NavDashboard {
  goToPlanificaciones: (f?: FiltrosPaac) => void;
  goToPaads: (f?: FiltrosPaad) => void;
  onOpenDoc: (id: string) => void;
  onOpenPaad: (id: string) => void;
}

/** Query string de los filtros (deep-link a `/planificaciones` o `/paads`). */
export function queryFiltros(f: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const ESTADOS_REVISION_PAAC = ['ENVIADO_A_REVISION', 'APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR'];
export const ESTADOS_FAVORABLES = ['APROBADO_PLENO', 'ELEVADO_AL_CONSEJO', 'FINALIZADO'];

export const paacsDe = (paacs: PaacResumen[], carreraId: string) => paacs.filter((d) => d.carreraId === carreraId);
export const ordenanzaDe = (paacs: PaacResumen[], carreraId: string) => paacs.find((d) => d.carreraId === carreraId)?.ordenanza;

export function estadosPaad(paads: PaadResumen[]) {
  return {
    borrador: contar(paads, (d) => d.state === 'BORRADOR'),
    revision: contar(paads, (d) => d.state === 'ENVIADO_A_REVISION'),
    observado: contar(paads, (d) => d.state === 'OBSERVADO'),
    aprobado: contar(paads, (d) => d.state === 'APROBADO'),
  };
}

export const COLOR_ESTADO_PAAC = (state: string) =>
  ESTADOS_FAVORABLES.includes(state) ? COLOR.aprobado : ESTADOS_REVISION_PAAC.includes(state) ? COLOR.revision : state === 'OBSERVADO' ? COLOR.observado : COLOR.pendiente;

export type EstadoArea = 'aprobado' | 'observado' | 'pendiente';
export const areaDe = (d: Dictamen): EstadoArea => (d === 'FAVORABLE' ? 'aprobado' : d === 'CON_OBSERVACIONES' ? 'observado' : 'pendiente');

const REGIMEN: Record<string, string> = { '1C': '1C', '2C': '2C', ANUAL: 'Anual' };
export const regimenLabel = (r: string) => REGIMEN[r] ?? r;
