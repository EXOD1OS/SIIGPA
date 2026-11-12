// Tipos serializables de las vistas de Administración (se arman en el servidor con Prisma).

export const CARGOS_CATEDRA = ['TITULAR', 'ASOCIADO', 'ADJUNTO', 'JTP', 'AYUDANTE'] as const;
export const CARGO_LABEL: Record<string, string> = {
  TITULAR: 'Profesor Titular',
  ASOCIADO: 'Profesor Asociado',
  ADJUNTO: 'Profesor Adjunto',
  JTP: 'Jefe de Trabajos Prácticos',
  AYUDANTE: 'Ayudante',
};

export const ROLES_ORDENADOS = ['DOCENTE', 'DIRECCION_CARRERA', 'UAP', 'CONSEJO_DEPARTAMENTAL', 'ADMINISTRADOR'] as const;
export type Rol = (typeof ROLES_ORDENADOS)[number];

export const ROL_DESCRIPCION: Record<Rol, string> = {
  DOCENTE: 'Integra equipos de cátedra, carga su PAAD y, si es responsable, el PAAC.',
  DIRECCION_CARRERA: 'Evalúa disciplinarmente los PAAC y PAAD de su carrera.',
  UAP: 'Evalúa pedagógicamente los PAAC y PAAD de todas las carreras.',
  CONSEJO_DEPARTAMENTAL: 'Protocoliza los PAAC aprobados: expediente y resolución.',
  ADMINISTRADOR: 'Gestiona la estructura académica, los equipos y los usuarios.',
};

export const ROL_BADGE: Record<string, string> = {
  DOCENTE: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  DIRECCION_CARRERA: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  UAP: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  CONSEJO_DEPARTAMENTAL: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  ADMINISTRADOR: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

export interface SedeAdmin {
  id: string;
  nombre: string;
  esCapital: boolean;
}
export interface DeptoAdmin {
  id: string;
  nombre: string;
}
export interface CarreraAdmin {
  id: string;
  codigo: string;
  nombre: string;
  sedeId: string;
  departamentoId: string;
  /** Dirección de Carrera (usuario con rol DIRECCION_CARRERA y esta carrera). */
  director: string | null;
}
export interface PlanAdmin {
  id: string;
  ordenanza: string;
  enfoque: string;
  carreraId: string;
}
export interface AsignaturaAdmin {
  id: string;
  nombre: string;
  anoCursada: number;
  regimen: string;
  creditoHorario: number;
  contenidosMinimos: string;
  planId: string;
  carreraId: string;
  departamentoRadicacionId: string;
}
export interface DocenteAdmin {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
}
/** Integrante del equipo de cátedra en el ciclo seleccionado. */
export interface AsignacionAdmin {
  asignaturaId: string;
  docenteId: string;
  categoria: string;
  esResponsable: boolean;
}

export interface EstructuraAdmin {
  ciclo: number;
  sedes: SedeAdmin[];
  departamentos: DeptoAdmin[];
  carreras: CarreraAdmin[];
  planes: PlanAdmin[];
  asignaturas: AsignaturaAdmin[];
  docentes: DocenteAdmin[];
  asignaciones: AsignacionAdmin[];
  /** Estado de la planificación de cada asignatura en el ciclo (si existe). */
  estadoPlanif: Record<string, string>;
}

/** Usuario con sus cátedras del ciclo vigente (vista Usuarios y accesos). */
export interface UsuarioAdmin {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  rol: Rol;
  carreraId: string | null;
  mustChangePassword: boolean;
  catedras: CatedraAsignada[];
}

export interface CatedraAsignada {
  asignaturaId: string;
  asignaturaNombre: string;
  carreraId: string;
  carreraCodigo: string;
  cargo: string;
  esResponsable: boolean;
}
