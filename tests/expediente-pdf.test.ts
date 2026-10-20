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