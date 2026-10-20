import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirCopias } from '../src/lib/migrar-paad';
import { defaultPaad } from '../src/lib/defaults';

function copia(id: string, datos = defaultPaad(), presentado = false, observaciones = 0) {
  return { id, datosPaad: datos, estadoPresento: presentado ? 'PRESENTO' : 'NO_PRESENTO', observaciones };
}
test('unifica copias iguales conservando ambas fuentes', () => {
  assert.deepEqual(elegirCopias([copia('a'), copia('b')]), { conflicto: false, ids: ['a', 'b'] });
});
test('las copias vacías con presentación incompatible requieren elección', () => {
  assert.equal(elegirCopias([copia('a'), copia('b', defaultPaad(), true)]).conflicto, true);
});
test('el mismo contenido no vacío puede presentarse desde cualquiera de las copias', () => {
  const datos = defaultPaad(); datos.gestion.detalle = 'Mismo contenido anual';
  assert.equal(elegirCopias([copia('a', datos), copia('b', datos, true)]).conflicto, false);
});
test('la comparación no depende del orden de las claves JSON', () => {
  const datos = defaultPaad();
  const inverso = Object.fromEntries(Object.entries(datos).reverse()) as typeof datos;
  assert.equal(elegirCopias([copia('a', datos), copia('b', inverso)]).conflicto, false);
});
test('usa una copia con contenido si las otras están vacías y sin antecedentes', () => {
  const datos = defaultPaad(); datos.gestion.detalle = 'Actividad anual';
  assert.deepEqual(elegirCopias([copia('a'), copia('b', datos)]), { conflicto: false, ids: ['b'] });
});
test('detecta contenidos distintos', () => {
  const a = defaultPaad(), b = defaultPaad(); a.gestion.detalle = 'A'; b.gestion.detalle = 'B';
  assert.equal(elegirCopias([copia('a', a), copia('b', b)]).conflicto, true);
});
test('no descarta una copia vacía que fue presentada', () => {
  const b = defaultPaad(); b.gestion.detalle = 'B';
  assert.equal(elegirCopias([copia('a', defaultPaad(), true), copia('b', b)]).conflicto, true);
});
test('no descarta una copia vacía con observaciones', () => {
  const b = defaultPaad(); b.gestion.detalle = 'B';
  assert.equal(elegirCopias([copia('a', defaultPaad(), false, 1), copia('b', b)]).conflicto, true);
});
test('las copias vacías con igual cantidad de observaciones pero distinto historial son un conflicto', () => {
  assert.equal(elegirCopias([
    { ...copia('a', defaultPaad(), true, 1), antecedentes: 'corrección A' },
    { ...copia('b', defaultPaad(), true, 1), antecedentes: 'corrección B' },
  ]).conflicto, true);
});
