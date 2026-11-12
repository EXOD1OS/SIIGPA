// Seed de demostración: borra los datos del dominio y carga exactamente el conjunto ficticio
// de `src/prototipo/data/mockData.ts` (copia literal de `_prototipo/src/data/mockData.ts`).
//
// Formatos (los mismos que escribe la aplicación y lee `lib/prototipo-adapter.ts`):
// - `datosPaac` / `datosPaad`: JSON completo del editor (PaacContenido / PaadContenido).
// - `informePedagogico` / `informeDisciplinar`: modelo Ord. 219/22 de `types/informes.ts`.
// - Observaciones ancladas como `"<paac|paad>.<campo>::<sección>"`.
import { loadEnvConfig } from '@next/env';
import { Prisma, PrismaClient, UserRole, type PaadStatus, type PlanifStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createInitialData } from '../src/prototipo/data/mockData';
import { domainDatabaseIsEmpty } from '../src/lib/database-state';

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

const ROL: Record<string, UserRole> = {
  Administrador: UserRole.ADMINISTRADOR,
  Docente: UserRole.DOCENTE,
  UAP: UserRole.UAP,
  Director: UserRole.DIRECCION_CARRERA,
  Consejo: UserRole.CONSEJO_DEPARTAMENTAL,
};

/** Cargo del catálogo del prototipo → categoría de Prisma (inversa de CARGO_PROTOTIPO). */
const CATEGORIA: Record<string, string> = {
  'Profesor Titular': 'TITULAR',
  'Profesor Asociado': 'ASOCIADO',
  'Profesor Adjunto': 'ADJUNTO',
  'Jefe de Trabajos Prácticos': 'JTP',
  'Ayudante de Primera': 'AYUDANTE',
};

const ESTADOS_PAAC: PlanifStatus[] = ['BORRADOR', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR', 'APROBADO_PLENO', 'ELEVADO_AL_CONSEJO', 'FINALIZADO'];
const ESTADOS_PAAD: PaadStatus[] = ['BORRADOR', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO'];

/** "dd/mm/aaaa" → Date (mediodía UTC, sin corrimiento de zona horaria). */
function fecha(v: unknown): Date | null {
  const m = typeof v === 'string' ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v) : null;
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12)) : null;
}

function exigir<T>(valor: T | undefined, que: string): T {
  if (valor === undefined) throw new Error(`mockData inconsistente: ${que}`);
  return valor;
}

/** Borra todos los datos del dominio respetando las claves foráneas. */
async function vaciarBase() {
  await prisma.$transaction([
    prisma.archivoExpediente.deleteMany(),
    prisma.itemObservacion.deleteMany(),
    prisma.paadDocente.deleteMany(),
    prisma.integrantePlanificacion.deleteMany(),
    prisma.planificacion.deleteMany(),
    prisma.dictamenPaad.deleteMany(),
    prisma.observacionPaad.deleteMany(),
    prisma.presentacionPaad.deleteMany(),
    prisma.paadAnual.deleteMany(),
    prisma.asignacionCatedra.deleteMany(),
    prisma.asignatura.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.planEstudio.deleteMany(),
    prisma.carrera.deleteMany(),
    prisma.departamento.deleteMany(),
    prisma.sede.deleteMany(),
  ]);
}

async function main() {
  // Protección para servidores: en producción solo se reinicia una base con datos si se pide explícitamente.
  if (process.env.NODE_ENV === 'production' && process.env.SEED_RESET !== 'true' && !(await domainDatabaseIsEmpty(prisma))) {
    throw new Error('La base tiene datos. En producción el seed solo la reinicia con SEED_RESET=true.');
  }

  await vaciarBase();

  const M = createInitialData();
  const passwordHash = await bcrypt.hash('unlar2026', 10);
  const id = new Map<string, string>();
  const db = (protoId: string | null | undefined, que: string) => exigir(protoId ? id.get(protoId) : undefined, `${que} "${protoId}" sin crear`);

  for (const s of M.sedes) id.set(s.id, (await prisma.sede.create({ data: { nombre: s.nombre, esCapital: s.esCapital } })).id);
  for (const d of M.departamentos) id.set(d.id, (await prisma.departamento.create({ data: { nombre: d.nombre } })).id);
  for (const c of M.carreras) {
    const creada = await prisma.carrera.create({
      data: { nombre: c.nombre, codigo: c.codigo, sedeId: db(c.sedeId, 'sede'), departamentoId: db(c.departamentoId, 'departamento') },
    });
    id.set(c.id, creada.id);
  }
  for (const p of M.planes) {
    const creado = await prisma.planEstudio.create({ data: { carreraId: db(p.carreraId, 'carrera'), ordenanza: p.ordenanza, enfoque: p.enfoque, activo: p.activo } });
    id.set(p.id, creado.id);
  }
  for (const a of M.asignaturas) {
    const creada = await prisma.asignatura.create({
      data: {
        planEstudioId: db(a.planEstudioId, 'plan'),
        departamentoRadicacionId: db(a.departamentoRadicacionId, 'departamento'),
        nombre: a.nombre,
        anoCursada: a.anoCursada,
        regimen: a.regimenDictado,
        creditoHorario: a.horasTotales,
        contenidosMinimosOficiales: a.contenidosMinimos,
      },
    });
    id.set(a.id, creada.id);
  }
  for (const u of M.usuarios) {
    const creado = await prisma.usuario.create({
      data: {
        email: u.email,
        dni: u.dni,
        passwordHash,
        mustChangePassword: u.mustChangePassword,
        nombre: u.nombre,
        apellido: u.apellido,
        rol: exigir(ROL[u.rol], `rol ${u.rol}`),
        carreraId: u.carreraId ? db(u.carreraId, 'carrera') : null,
      },
    });
    id.set(u.id, creado.id);
  }
  for (const e of M.equiposCatedra) {
    await prisma.asignacionCatedra.create({
      data: {
        asignaturaId: db(e.asignaturaId, 'asignatura'),
        docenteId: db(e.docenteId, 'docente'),
        cicloLectivo: e.cicloLectivo,
        categoria: exigir(CATEGORIA[e.cargo], `cargo ${e.cargo}`),
        esResponsable: e.esResponsable,
      },
    });
  }

  // Autores de observaciones y dictámenes: UAP o la Dirección de la carrera correspondiente.
  const uap = exigir(M.usuarios.find((u) => u.rol === 'UAP'), 'usuario UAP');
  const directorDe = (carreraId: string) => exigir(M.carreras.find((c) => c.id === carreraId)?.directorId, `director de ${carreraId}`);
  const carreraDeAsig = (asigId: string) => {
    const plan = M.planes.find((p) => p.id === M.asignaturas.find((a) => a.id === asigId)?.planEstudioId);
    return exigir(plan?.carreraId, `carrera de ${asigId}`);
  };
  const autor = (area: string, carreraId: string) =>
    area === 'direccion' ? { autorId: db(directorDe(carreraId), 'director'), rolAutor: UserRole.DIRECCION_CARRERA } : { autorId: db(uap.id, 'UAP'), rolAutor: UserRole.UAP };

  /** Informe del prototipo → JSON guardado (Ord. 219/22). Pendiente → sin informe. */
  const informe = (r: any, area: 'uap' | 'direccion'): Prisma.InputJsonValue | typeof Prisma.DbNull => {
    if (!r || (r.dictamen !== 'APROBADO' && r.dictamen !== 'OBSERVADO')) return Prisma.DbNull;
    const firma = { modelo: 'ORD_219_2022', observaciones: (area === 'uap' ? r.obsGenerales : r.obsDisciplinares) ?? '', firmante: r.by ?? '', fecha: r.fecha ?? '' };
    if (r.dictamen === 'OBSERVADO') return { ...firma, dictamen: 'REQUIERE_CORRECCION' };
    if (area === 'uap') return { ...firma, dictamen: 'FAVORABLE', pedagogico: r.pedagogico };
    // El cuadro de PAAD del informe disciplinar referencia docentes: se pasan a los ids de la base.
    const disciplinar = { ...r.disciplinar, paads: (r.disciplinar?.paads ?? []).map((p: { docenteId: string }) => ({ ...p, docenteId: db(p.docenteId, 'docente') })) };
    return { ...firma, dictamen: 'CUMPLE', disciplinar };
  };

  const ancla = (c: { campoPath: string; section?: number }) => (c.section !== undefined ? `${c.campoPath}::${c.section}` : c.campoPath);
  const resumen = { paac: {} as Record<string, number>, paad: {} as Record<string, number> };

  for (const d of M.docs) {
    if (d.type === 'PAAC') {
      if (!ESTADOS_PAAC.includes(d.state)) throw new Error(`Estado PAAC inválido en ${d.id}: ${d.state}`);
      const carreraId = carreraDeAsig(d.asignaturaId);
      const equipo = M.equiposCatedra.filter((e) => e.asignaturaId === d.asignaturaId && e.cicloLectivo === d.cycle);
      await prisma.planificacion.create({
        data: {
          asignaturaId: db(d.asignaturaId, 'asignatura'),
          cicloLectivo: d.cycle,
          docenteResponsableId: db(d.owner, 'responsable'),
          estado: d.state,
          datosPaac: d.paac as Prisma.InputJsonValue,
          informePedagogico: informe(d.pedReport, 'uap'),
          informeDisciplinar: informe(d.discReport, 'direccion'),
          numeroExpediente: d.expediente || null,
          numeroResolucion: d.resolucion || null,
          fechaElevacion: fecha(d.fechaElevacion),
          fechaAprobacionCd: fecha(d.fechaResolucion),
          integrantes: { create: equipo.map((e) => ({ docenteId: db(e.docenteId, 'docente'), cargoEnCatedra: CATEGORIA[e.cargo] })) },
          observaciones: {
            create: (d.comments ?? []).map((c: { area: string; campoPath: string; section?: number; text: string; resolved: boolean; date?: string }) => ({
              documentoTipo: 'PAAC',
              campoPath: ancla(c),
              mensaje: c.text,
              resuelto: c.resolved,
              ...autor(c.area, carreraId),
              ...(fecha(c.date) ? { createdAt: fecha(c.date) as Date } : {}),
            })),
          },
        },
      });
      resumen.paac[d.state] = (resumen.paac[d.state] ?? 0) + 1;
    } else if (d.type === 'PAAD') {
      if (!ESTADOS_PAAD.includes(d.state)) throw new Error(`Estado PAAD inválido en ${d.id}: ${d.state}`);
      const paad = await prisma.paadAnual.create({
        data: {
          docenteId: db(d.owner, 'docente'),
          cicloLectivo: d.cycle,
          datosPaad: d.paad as Prisma.InputJsonValue,
          estado: d.state,
          carreraEvaluadoraId: d.evalCareer ? db(d.evalCareer, 'carrera evaluadora') : null,
        },
      });
      // Presentado alguna vez: primera presentación con sus dictámenes y observaciones.
      if (d.state !== 'BORRADOR') {
        const presentacion = await prisma.presentacionPaad.create({
          data: { paadId: paad.id, numero: 1, datosPaad: d.paad as Prisma.InputJsonValue, autorId: db(d.owner, 'docente'), rolAutor: UserRole.DOCENTE },
        });
        for (const [area, r] of [['uap', d.pedReport], ['direccion', d.discReport]] as const) {
          if (r?.dictamen !== 'APROBADO' && r?.dictamen !== 'OBSERVADO') continue;
          const obs = (area === 'uap' ? r.obsGenerales : r.obsDisciplinares) || '';
          await prisma.dictamenPaad.create({
            data: {
              presentacionId: presentacion.id,
              ...autor(area, d.evalCareer),
              resultado: r.dictamen === 'APROBADO' ? 'FAVORABLE' : 'REQUIERE_CORRECCION',
              comentario: obs || (r.dictamen === 'APROBADO' ? '' : 'Ver observaciones ancladas en los apartados.'),
              ...(fecha(r.fecha) ? { createdAt: fecha(r.fecha) as Date } : {}),
            },
          });
        }
        for (const c of d.comments ?? []) {
          await prisma.observacionPaad.create({
            data: {
              paadId: paad.id,
              presentacionId: presentacion.id,
              campoPath: ancla(c),
              mensaje: c.text,
              resuelto: c.resolved,
              ...autor(c.area, d.evalCareer),
              ...(fecha(c.date) ? { createdAt: fecha(c.date) as Date } : {}),
            },
          });
        }
      }
      resumen.paad[d.state] = (resumen.paad[d.state] ?? 0) + 1;
    }
  }

  console.log('Seed ejecutado: base reiniciada con los datos de mockData.ts.');
  console.log(`Carreras: ${M.carreras.map((c) => c.codigo).join(', ')} · ${M.asignaturas.length} asignaturas · ${M.usuarios.length} usuarios.`);
  console.log('PAAC por estado:', resumen.paac);
  console.log('PAAD por estado:', resumen.paad);
  console.log('Usuarios de prueba (contraseña: unlar2026; también se ingresa con el DNI):');
  for (const u of M.usuarios) console.log(`  ${u.email.padEnd(32)} ${u.rol}${u.carreraId ? ` (${M.carreras.find((c) => c.id === u.carreraId)?.codigo})` : ''}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
