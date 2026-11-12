import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient, UserRole, Prisma } from '@prisma/client';
import { asegurarPaad, operarPaad, paadVisible, resolverObservacionPersonal, type PaadActor } from '../src/lib/paad';
import { migrarPaads, elegirFuenteMigracion } from '../src/lib/migrar-paad';
import { generarPlanificacionesDelCiclo } from '../src/lib/generar-planificaciones';
import { defaultPaad } from '../src/lib/defaults';

// Estas pruebas crean fixtures. Exigen una base aislada explícita, nunca usan .env.local.
const url = process.env.PAAD_TEST_DATABASE_URL;
if (!url || !/_(qa|vacia)_/.test(new URL(url).pathname)) throw new Error('Indicá PAAD_TEST_DATABASE_URL de una base _qa_ o _vacia_.');
const db = new PrismaClient({ datasources: { db: { url } } });
const run = randomUUID();
let checks = 0;
function ok(value: unknown) { assert.ok(value); checks++; }
async function rechaza(action: Promise<unknown>, pattern: RegExp) { await assert.rejects(action, pattern); checks++; }
async function main() {
  const sede = await db.sede.create({ data: { nombre: 'QA ' + run } });
  const departamento = await db.departamento.create({ data: { nombre: 'QA ' + run } });
  const carrera = await db.carrera.create({ data: { departamentoId: departamento.id, sedeId: sede.id, nombre: 'QA ISI', codigo: 'QA' } });
  const ajena = await db.carrera.create({ data: { departamentoId: departamento.id, sedeId: sede.id, nombre: 'QA otra', codigo: 'QB' } });
  const plan = await db.planEstudio.create({ data: { carreraId: carrera.id, ordenanza: 'QA' } });
  async function user(nombre: string, rol: UserRole, carreraId: string | null = null) {
    return db.usuario.create({ data: { nombre, apellido: 'QA', email: nombre + '.' + run + '@example.test', dni: nombre + run,
      passwordHash: 'solo-fixture-no-login', rol, carreraId } });
  }
  const [docente, auxiliar, externo, uap, director, otroDirector, admin] = await Promise.all([
    user('docente', 'DOCENTE'), user('auxiliar', 'DOCENTE'), user('externo', 'DOCENTE'),
    user('uap', 'UAP'), user('director', 'DIRECCION_CARRERA', carrera.id), user('otro', 'DIRECCION_CARRERA', ajena.id),
    user('admin', 'ADMINISTRADOR'),
  ]);
  const actor = (u: typeof docente): PaadActor => ({ id: u.id, rol: u.rol, carreraId: u.carreraId });
  async function materia(nombre: string, ciclo = 2090) {
    const a = await db.asignatura.create({ data: { nombre, planEstudioId: plan.id, departamentoRadicacionId: departamento.id,
      anoCursada: 1, regimen: 'ANUAL', creditoHorario: 30, contenidosMinimosOficiales: 'QA' } });
    const p = await db.planificacion.create({ data: { asignaturaId: a.id, cicloLectivo: ciclo, docenteResponsableId: docente.id, datosPaac: {},
      integrantes: { create: [{ docenteId: docente.id, cargoEnCatedra: 'TITULAR' }, { docenteId: auxiliar.id, cargoEnCatedra: 'JTP' }] } } });
    await db.asignacionCatedra.create({ data: { asignaturaId: a.id, cicloLectivo: ciclo, docenteId: docente.id, categoria: 'TITULAR', esResponsable: true } });
    return p;
  }
  const m1 = await materia('QA Materia 1'), m2 = await materia('QA Materia 2');
  const p = await asegurarPaad(db, docente.id, 2090);
  const segundo = await asegurarPaad(db, docente.id, 2090);
  ok(p.id === segundo.id && p.carreraEvaluadoraId === carrera.id);
  await asegurarPaad(db, auxiliar.id, 2090);
  ok((await paadVisible(db, actor(auxiliar), p.id)).id === p.id);
  await rechaza(paadVisible(db, actor(externo), p.id), /no autorizado/);
  await rechaza(paadVisible(db, actor(otroDirector), p.id), /no autorizado/);
  await rechaza(operarPaad(db, actor(auxiliar), p.id, 'guardar', { datos: defaultPaad() }), /propietario/);
  const data = defaultPaad(); data.gestion.detalle = 'Versión inicial';
  await operarPaad(db, actor(docente), p.id, 'guardar', { datos: data });
  ok(await db.presentacionPaad.count({ where: { paadId: p.id } }) === 0);
  const presentaciones = await Promise.allSettled([
    operarPaad(db, actor(docente), p.id, 'presentar', {}), operarPaad(db, actor(docente), p.id, 'presentar', {}),
  ]);
  ok(presentaciones.filter(r => r.status === 'fulfilled').length === 1);
  ok(await db.presentacionPaad.count({ where: { paadId: p.id } }) === 1);
  let full = await paadVisible(db, actor(docente), p.id);
  const rev1 = full.presentaciones[0];
  ok(rev1.autorId === docente.id && rev1.rolAutor === 'DOCENTE');
  await rechaza(operarPaad(db, actor(admin), p.id, 'direccion', { carreraId: ajena.id }), /primera presentación/);
  await rechaza(operarPaad(db, actor(otroDirector), p.id, 'dictaminar', { presentacionId: rev1.id, resultado: 'FAVORABLE' }), /autorizado|revisar/);
  await operarPaad(db, actor(director), p.id, 'dictaminar', { presentacionId: rev1.id, resultado: 'REQUIERE_CORRECCION', mensaje: 'Corregir gestión' });
  full = await paadVisible(db, actor(docente), p.id);
  ok(full.estado === 'OBSERVADO');
  ok((await db.planificacion.findUniqueOrThrow({ where: { id: m1.id } })).estado === 'BORRADOR');
  await rechaza(operarPaad(db, actor(docente), p.id, 'presentar', {}), /observaciones/);
  await rechaza(operarPaad(db, actor(uap), p.id, 'dictaminar', { presentacionId: rev1.id, resultado: 'FAVORABLE' }), /revisión/);
  data.gestion.detalle = 'Versión corregida';
  await operarPaad(db, actor(docente), p.id, 'guardar', { datos: data });
  await resolverObservacionPersonal(db, actor(docente), full.observaciones[0].id);
  await operarPaad(db, actor(docente), p.id, 'presentar', {});
  full = await paadVisible(db, actor(docente), p.id);
  const rev2 = full.presentaciones[0];
  ok(rev2.numero === 2 && rev2.dictamenes.length === 0);
  ok((rev1.datosPaad as unknown as typeof data).gestion.detalle === 'Versión inicial');
  await rechaza(operarPaad(db, actor(uap), p.id, 'dictaminar', { presentacionId: rev1.id, resultado: 'FAVORABLE' }), /presentación cambió/);
  // Aprobación simple: el primer dictamen favorable (UAP o Dirección) aprueba; el otro queda rechazado.
  const aprobaciones = await Promise.allSettled([
    operarPaad(db, actor(uap), p.id, 'dictaminar', { presentacionId: rev2.id, resultado: 'FAVORABLE' }),
    operarPaad(db, actor(director), p.id, 'dictaminar', { presentacionId: rev2.id, resultado: 'FAVORABLE' }),
  ]);
  ok(aprobaciones.filter(r => r.status === 'fulfilled').length === 1);
  full = await paadVisible(db, actor(docente), p.id);
  ok(full.estado === 'APROBADO' && full.presentaciones[0].dictamenes.length === 1);
  await rechaza(operarPaad(db, actor(docente), p.id, 'guardar', { datos: data }), /editable/);
  await rechaza(operarPaad(db, actor(uap), p.id, 'observar', { presentacionId: rev2.id, mensaje: 'Tarde' }), /revisión/);
  await db.integrantePlanificacion.delete({ where: { planificacionId_docenteId: { planificacionId: m2.id, docenteId: docente.id } } });
  ok((await db.paadAnual.findUniqueOrThrow({ where: { id: p.id } })).estado === 'APROBADO');
  const next = await asegurarPaad(db, docente.id, 2091);
  ok(next.id !== p.id && next.estado === 'BORRADOR');
  await rechaza(operarPaad(db, actor(docente), next.id, 'presentar', {}), /Dirección responsable/);
  await operarPaad(db, actor(admin), next.id, 'direccion', { carreraId: carrera.id });
  ok((await asegurarPaad(db, docente.id, 2091)).carreraEvaluadoraId === carrera.id);
  // Una segunda carrera elimina una inferencia automática, pero respeta una elección manual.
  const multi = await asegurarPaad(db, auxiliar.id, 2090);
  const planAjeno = await db.planEstudio.create({ data: { carreraId: ajena.id, ordenanza: 'QA' } });
  const asigAjena = await db.asignatura.create({ data: { planEstudioId: planAjeno.id, departamentoRadicacionId: departamento.id,
    nombre: 'Otra QA', anoCursada: 1, regimen: 'ANUAL', creditoHorario: 1, contenidosMinimosOficiales: '' } });
  await db.asignacionCatedra.create({ data: { asignaturaId: asigAjena.id, cicloLectivo: 2090, docenteId: auxiliar.id, categoria: 'JTP' } });
  ok((await asegurarPaad(db, auxiliar.id, 2090)).carreraEvaluadoraId === null);
  await operarPaad(db, actor(admin), multi.id, 'direccion', { carreraId: carrera.id });
  ok((await asegurarPaad(db, auxiliar.id, 2090)).carreraEvaluadoraId === carrera.id);
  ok((await paadVisible(db, actor(otroDirector), multi.id)).id === multi.id);
  // Migración con conflicto real, observación y elección explícita.
  const l1 = await materia('Legacy 1', 2092), l2 = await materia('Legacy 2', 2092);
  const d1 = defaultPaad(), d2 = defaultPaad(); d1.gestion.detalle = 'Contenido A'; d2.gestion.detalle = 'Contenido B';
  const c1 = await db.paadDocente.create({ data: { docenteId: docente.id, planificacionId: l1.id, cargoEnCatedra: 'TITULAR', datosPaad: d1 as unknown as Prisma.InputJsonValue, estadoPresento: 'PRESENTO' } });
  const c2 = await db.paadDocente.create({ data: { docenteId: docente.id, planificacionId: l2.id, cargoEnCatedra: 'TITULAR', datosPaad: d2 as unknown as Prisma.InputJsonValue } });
  await db.itemObservacion.create({ data: { planificacionId: l1.id, docentePaadId: c1.id, documentoTipo: 'PAAD',
    campoPath: 'gestion.detalle', autorId: uap.id, rolAutor: 'UAP', mensaje: 'Legacy pendiente' } });
  await migrarPaads(db);
  const migrated = await db.paadAnual.findUniqueOrThrow({ where: { docenteId_cicloLectivo: { docenteId: docente.id, cicloLectivo: 2092 } } });
  ok(migrated.conflictoMigracion);
  await rechaza(operarPaad(db, actor(docente), migrated.id, 'guardar', { datos: d1 }), /copias/);
  await rechaza(elegirFuenteMigracion(db, migrated.id, 'ajena'), /fuente/);
  await elegirFuenteMigracion(db, migrated.id, c1.id);
  const elegido = await paadVisible(db, actor(docente), migrated.id);
  ok(!elegido.conflictoMigracion && elegido.estado === 'OBSERVADO' && elegido.observaciones.length === 1);
  await migrarPaads(db);
  ok(await db.observacionPaad.count({ where: { paadId: migrated.id } }) === 1);
  ok(!!await db.paadDocente.findUnique({ where: { id: c2.id } }));
  const historialPaac = await db.planificacion.findUniqueOrThrow({ where: { id: l1.id } });
  ok(historialPaac.estado === 'BORRADOR');
  await db.integrantePlanificacion.delete({ where: { planificacionId_docenteId: { planificacionId: l2.id, docenteId: docente.id } } });
  await migrarPaads(db);
  ok(await db.integrantePlanificacion.count({ where: { planificacionId: l2.id, docenteId: docente.id } }) === 0);
  // Copias idénticas: conserva autoría, fechas, resolución y documentos PAAC.
  const i1 = await materia('Igual 1', 2094), i2 = await materia('Igual 2', 2094);
  const igual = defaultPaad(); igual.gestion.detalle = 'Mismo documento';
  const fuente1 = await db.paadDocente.create({ data: { docenteId: docente.id, planificacionId: i1.id,
    cargoEnCatedra: 'TITULAR', datosPaad: igual as unknown as Prisma.InputJsonValue, estadoPresento: 'PRESENTO' } });
  const fuente2 = await db.paadDocente.create({ data: { docenteId: docente.id, planificacionId: i2.id,
    cargoEnCatedra: 'TITULAR', datosPaad: igual as unknown as Prisma.InputJsonValue } });
  const fecha = new Date('2025-12-01T10:00:00Z');
  await db.itemObservacion.create({ data: { planificacionId: i1.id, docentePaadId: fuente1.id, documentoTipo: 'PAAD',
    campoPath: 'gestion.detalle', autorId: uap.id, rolAutor: 'UAP', mensaje: 'Resuelta antigua', resuelto: true, createdAt: fecha } });
  await db.planificacion.update({ where: { id: i1.id }, data: { estado: 'FINALIZADO', numeroExpediente: 'QA histórico', numeroResolucion: 'QA resolución' } });
  await migrarPaads(db);
  const unificado = await db.paadAnual.findUniqueOrThrow({ where: { docenteId_cicloLectivo: { docenteId: docente.id, cicloLectivo: 2094 } },
    include: { observaciones: true, presentaciones: { include: { dictamenes: true } } } });
  ok(unificado.estado === 'ENVIADO_A_REVISION' && !unificado.conflictoMigracion && unificado.presentaciones[0].dictamenes.length === 0);
  ok(unificado.observaciones[0].autorId === uap.id && unificado.observaciones[0].createdAt.getTime() === fecha.getTime() && unificado.observaciones[0].resuelto);
  const historico = await db.planificacion.findUniqueOrThrow({ where: { id: i1.id } });
  ok(historico.estado === 'FINALIZADO' && historico.numeroResolucion === 'QA resolución' && !!await db.paadDocente.findUnique({ where: { id: fuente2.id } }));
  await migrarPaads(db);
  ok(await db.observacionPaad.count({ where: { paadId: unificado.id } }) === 1);
  // Generación completa y repetición: sin duplicar ni reutilizar el PAAD aprobado.
  await generarPlanificacionesDelCiclo(db, 2093);
  const count = await db.paadAnual.count({ where: { cicloLectivo: 2093 } });
  const segundaGeneracion = await generarPlanificacionesDelCiclo(db, 2093);
  ok(segundaGeneracion.creadas === 0 && count === await db.paadAnual.count({ where: { cicloLectivo: 2093 } }));
  // Deja un conflicto aislado para probar también la elección de fuente desde la interfaz.
  const v1 = await materia('QA Copia A', 2095), v2 = await materia('QA Copia B', 2095);
  const a = defaultPaad(), b = defaultPaad(); a.gestion.detalle = 'Fuente A: actividades anuales'; b.gestion.detalle = 'Fuente B: contenido diferente';
  const copiaA = await db.paadDocente.create({ data: { docenteId: externo.id, planificacionId: v1.id, cargoEnCatedra: 'JTP',
    datosPaad: a as unknown as Prisma.InputJsonValue, estadoPresento: 'PRESENTO' } });
  await db.paadDocente.create({ data: { docenteId: externo.id, planificacionId: v2.id, cargoEnCatedra: 'JTP',
    datosPaad: b as unknown as Prisma.InputJsonValue } });
  await db.itemObservacion.create({ data: { planificacionId: v1.id, docentePaadId: copiaA.id, documentoTipo: 'PAAD',
    campoPath: 'gestion.detalle', autorId: uap.id, rolAutor: 'UAP', mensaje: 'Antecedente de la fuente A' } });
  await migrarPaads(db);
  const visual = await db.paadAnual.findUniqueOrThrow({ where: { docenteId_cicloLectivo: { docenteId: externo.id, cicloLectivo: 2095 } } });
  ok(visual.conflictoMigracion);
  console.log('Conflicto QA para demostración: /paads/' + visual.id);
  console.log(checks + ' comprobaciones de integración correctas (permisos, concurrencia, migración y ciclos).');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
