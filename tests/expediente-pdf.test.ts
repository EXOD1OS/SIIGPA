import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generarPdfExpediente } from '../src/lib/expediente-pdf';
import { tiposPdfExpediente } from '../src/lib/archivo-expediente';

test('genera un PDF con encabezado de expediente y contenido anidado', async () => {
  const pdf = await generarPdfExpediente({
    titulo: 'Informe de prueba',
    contexto: {
      asignatura: 'Álgebra',
      carrera: 'Ingeniería',
      sede: 'Capital',
      cicloLectivo: 2026,
      planEstudio: 'Ord. 171/2019',
      numeroExpediente: 'EXP-1',
      numeroResolucion: 'RES-2',
      fechaAprobacion: '18/10/2026',
    },
    datos: {
      dictamen: 'FAVORABLE',
      integrantes: [{ nombre: 'Docente de prueba', aprobado: true }],
      observaciones: [],
    },
  });

  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(pdf.byteLength > 500);
});

test('archiva por defecto PAAC, PAAD y los tres informes', () => {
  assert.deepEqual(tiposPdfExpediente(''), [
    'PAAC',
    'PAAD',
    'INFORME_PEDAGOGICO',
    'INFORME_DISCIPLINAR',
    'INFORME_GENERAL',
  ]);
});

test('permite limitar los tipos almacenados y elimina duplicados', () => {
  assert.deepEqual(tiposPdfExpediente('PAAC, PAAD,PAAC'), ['PAAC', 'PAAD']);
});

test('rechaza tipos de PDF no reconocidos en la configuración', () => {
  assert.throws(() => tiposPdfExpediente('PAAC,INFORME_INEXISTENTE'), /tipos no admitidos/);
});
test('aplica el diseño con escudo a los cuatro documentos archivados', async () => {
  const contexto = {
    asignatura: 'Álgebra',
    carrera: 'Ingeniería en Sistemas de Información',
    sede: 'Capital',
    cicloLectivo: 2026,
    planEstudio: 'Ord. 235/2023',
    numeroExpediente: 'EXP-1',
    numeroResolucion: 'RES-2',
    fechaAprobacion: '26/10/2026',
  };
  const documentos = [
    { tipo: 'PAAC', titulo: 'Plan Anual de Actividades de Cátedra (PAAC)', datos: { encabezado: { asignatura: 'Álgebra' }, fundamentacion: { importanciaAsignatura: 'Texto de prueba' } } },
    { tipo: 'INFORME_PEDAGOGICO', titulo: 'Informe Pedagógico — UAP', datos: { aspectosGenerales: { introduccion: 'PRESENTA_COMPLETA' }, aspectosCurriculares: { contenidos: 'DESARROLLADOS_EN_UNIDADES' }, dictamen: 'FAVORABLE' } },
    { tipo: 'INFORME_DISCIPLINAR', titulo: 'Informe Disciplinar — Dirección de Carrera', datos: { contenidos: 'CUMPLE', trabajosPracticos: { tp: 'ACORDE' }, bibliografia: { basica: 'PRESENTA' }, dictamen: 'CUMPLE' } },
    { tipo: 'INFORME_GENERAL', titulo: 'Informe General de PAAC', datos: { conclusionConjunta: 'Aprobado', recomendacion: 'FAVORABLE', elaboradoPorUap: true, elaboradoPorDireccion: true } },
  ] as const;
  for (const documento of documentos) {
    const pdf = await generarPdfExpediente({ ...documento, contexto });
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-', documento.tipo);
    assert.match(pdf.toString('latin1'), /\/Subtype\s*\/Image/, documento.tipo);
  }
});
